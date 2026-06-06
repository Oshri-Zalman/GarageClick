# Technical Design Document (TDD) - GarageClick
## ארכיטקטורה, עיצוב מערכות ו-API

**גרסה:** 2.1  
**תאריך:** יוני 2026  
**עדכום:** כל השינויים מה-SRS v2.1

---

## 1. High-Level Architecture (ארכיטקטורה כללית)

### 1.1 תיאור כללי

מערכת GarageClick בנויה על ארכיטקטורת **3-Tier (Three-Layer)** קלאסית:
- **Frontend:** ממשק Web בדפדפן (Desktop בלבד)
- **Backend:** Monolith עם שירותים לוגיים
- **Database:** SQL Relational עם נתונים מנורמלים

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│  • Kanban Board (3 עמודות עם כפתורים)                     │
│  • Ticket Management Interface                              │
│  • Parts Selection Interface                                │
│  • Manager Dashboard                                        │
│  • Secretary Dashboard                                      │
│  (HTML/CSS/JavaScript - מותאם Desktop)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/HTTPS REST API
┌──────────────────────▼──────────────────────────────────────┐
│                   BACKEND LAYER                             │
│  Node.js/Express + Business Logic Services                  │
│  ├─ Auth Controller (אימות + הרשאות)                       │
│  ├─ Customer Service (ניהול לקוחות)                        │
│  ├─ Ticket Service (ניהול כרטיסים)                         │
│  ├─ Workflow Service (State Machine)                        │
│  ├─ Parts Service (ניהול מלאי)                             │
│  ├─ Notification Service (WhatsApp)                         │
│  └─ Admin Service (כלי ניהול)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL Queries
┌──────────────────────▼──────────────────────────────────────┐
│                  DATABASE LAYER                             │
│  PostgreSQL/MySQL Relational                                │
│  ├─ users (משתמשים + roles)                                │
│  ├─ customers (לקוחות)                                      │
│  ├─ vehicles (רכבים)                                        │
│  ├─ tickets_work (כרטיסי עבודה)                             │
│  ├─ parts_inventory (מלאי חלפים)                            │
│  ├─ ticket_parts_used (חלפים שנעשה בהם שימוש)             │
│  └─ logs (audit trail)                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Architecture (ארכיטקטורה מפורטת)

### 2.1 מבנה Services

Backend מפורק לשירותים לוגיים, כל אחד עם אחריות ברורה:

| Service | אחריות | Endpoints ראשיים |
|---------|--------|-------------------|
| **Auth Controller** | אימות, סשנים, הרשאות | POST /login, POST /logout, GET /verify-token |
| **Customer Service** | CRUD לקוחות | GET/POST/PUT /customers, GET /customers/search |
| **Vehicle Service** | CRUD רכבים | GET/POST/PUT /vehicles |
| **Ticket Service** | יצירה וניהול כרטיסים | GET/POST/PUT /tickets, GET /tickets/:id |
| **Workflow Service** | State Machine וtransitions | PATCH /tickets/:id/status |
| **Parts Service** | ניהול מלאי חלפים | GET/POST/PUT /parts, GET /parts/compatible/:vehicleId |
| **Notification Service** | שליחת WhatsApp | POST /notifications/whatsapp (internal) |
| **Admin Service** | כלים ניהול (Manager בלבד) | GET /admin/employees, GET /admin/reports, POST /admin/users |

### 2.2 Flow של בקשה (Request-Response)

```
1. Frontend → Backend: POST /login {username, password}
   ↓
2. Auth Controller: Hash password, compare, generate JWT token
   ↓
3. Database: Query users table
   ↓
4. Backend → Frontend: {token, role, user_id}
   ↓
5. Frontend: Save token in session, load dashboard לפי role
```

---

## 3. Database Schema (מודל הנתונים)

### 3.1 טבלאות ליבה

#### **טבלה 1: users (משתמשים)**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Manager', 'Secretary', 'Mechanic') NOT NULL,
  full_name VARCHAR(255),
  email VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME ON UPDATE NOW()
);
```

**הרשאות לפי Role:**
- **Manager:** כל ההרשאות
- **Secretary:** פתיחת כרטיסים, שיוך, בחירת חלפים, עדכון סטטוסים, ניהול מלאי
- **Mechanic:** עדכון סטטוסים, בחירת חלפים (לכרטיסים שלו)

---

#### **טבלה 2: customers (לקוחות)**
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME ON UPDATE NOW()
);
```

**הערה:** יכול להיות חדש בעת פתיחת כרטיס (אם לא קיים במערכת)

---

#### **טבלה 3: vehicles (רכבים)**
```sql
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  customer_id INTEGER NOT NULL,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  manufacturer VARCHAR(100) NOT NULL,  -- Volkswagen, BMW וכו'
  model VARCHAR(100) NOT NULL,          -- Golf, 320i וכו'
  year INTEGER,                         -- שנת ייצור של הרכב הזה (2018)
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**הערה:** רכב יכול להיות חדש בעת פתיחת כרטיס

---

#### **טבלה 4: tickets_work (כרטיסי עבודה)**
```sql
CREATE TABLE tickets_work (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  ticket_number VARCHAR(20) UNIQUE NOT NULL,  -- ID_Ticket (auto-generated)
  vehicle_id INTEGER NOT NULL,
  created_by_id INTEGER NOT NULL,              -- מי פתח (Manager/Secretary/Mechanic)
  assigned_mechanic_id INTEGER NOT NULL,       -- איזה Mechanic יטפל
  description TEXT,                            -- תיאור התקלה
  status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
  estimated_completion_time DATETIME,
  created_at DATETIME DEFAULT NOW(),
  started_at DATETIME,                         -- כשלחצו "קבל"
  completed_at DATETIME,                       -- כשלחצו "סיים טיפול"
  
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (created_by_id) REFERENCES users(id),
  FOREIGN KEY (assigned_mechanic_id) REFERENCES users(id)
);
```

**סטטוסים:**
- **Pending:** כרטיס חדש, ממתין לעובד להתחיל
- **In Progress:** עובד לחץ "קבל" ועובד על הרכב
- **Completed:** עובד לחץ "סיים טיפול" + אישור ✓

---

#### **טבלה 5: parts_inventory (מלאי חלפים)**
```sql
CREATE TABLE parts_inventory (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  part_name VARCHAR(255) NOT NULL,           -- בלמים דיסק קדמי
  part_code VARCHAR(50) NOT NULL,             -- SKU/מקט
  manufacturer VARCHAR(100),                  -- Volkswagen, BMW וכו'
  model VARCHAR(100),                         -- Golf, 320i וכו'
  year_start INTEGER,                         -- מ-2015 (שנה מינימלית)
  quantity_current INTEGER NOT NULL,          -- כמות זמינה עכשיו
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME ON UPDATE NOW()
);
```

**Compatibility Matrix:**
- שדות: manufacturer, model, year_start, year_end
- זה מאפשר חיפוש מהיר של חלפים תואמים לרכב

---

#### **טבלה 6: ticket_parts_used (חלפים שנעשה בהם שימוש)**
```sql
CREATE TABLE ticket_parts_used (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  ticket_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity_used INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  
  FOREIGN KEY (ticket_id) REFERENCES tickets_work(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES parts_inventory(id)
);
```

**עדכון מלאי:**
- כשמפתחים כרטיס ובוחרים חלף:
  - `INSERT INTO ticket_parts_used (ticket_id, part_id, quantity_used)`
  - `UPDATE parts_inventory SET quantity_current = quantity_current - 1`

---

#### **טבלה 7: audit_log (לרישום פעילויות)**
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER,
  action VARCHAR(100),                   -- 'ticket_created', 'status_changed', וכו'
  resource_type VARCHAR(50),             -- 'ticket', 'part', וכו'
  resource_id INTEGER,
  old_value VARCHAR(500),
  new_value VARCHAR(500),
  timestamp DATETIME DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**דוגמה:**
```
user_id: 5 (עובד)
action: 'status_changed'
resource_type: 'ticket'
resource_id: 123
old_value: 'Pending'
new_value: 'In Progress'
timestamp: 2026-06-02 10:30:00
```

---

### 3.2 Indexes חשובים

```sql
-- חיפוש מהיר לפי טלפון/רכב
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);

-- חיפוש כרטיסים
CREATE INDEX idx_tickets_status ON tickets_work(status);
CREATE INDEX idx_tickets_mechanic ON tickets_work(assigned_mechanic_id);

-- חיפוש חלפים תואמים
CREATE INDEX idx_parts_compatibility ON parts_inventory(manufacturer, model, year_start);

-- audit trail
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

---

## 4. API Endpoints (מפורט)

### 4.1 Authentication

```
POST /api/auth/login
├─ Input: {username, password}
├─ Output: {token, user_id, role, full_name}
└─ Status: 200/401

POST /api/auth/logout
├─ Headers: Authorization: Bearer {token}
└─ Status: 200

GET /api/auth/verify-token
├─ Headers: Authorization: Bearer {token}
├─ Output: {valid: true/false, user_id, role}
└─ Status: 200/401
```

---

### 4.2 Vehicle Management

```
GET /api/vehicles/search
├─ Query: ?license_plate=123-456 (החיפוש הראשון בפתיחת כרטיס)
├─ Output (if found):
│  {
│    vehicle_id: 50,
│    license_plate: "123-456",
│    manufacturer: "Volkswagen",
│    model: "Golf",
│    year: 2018,
│    customer_id: 10,
│    customer_name: "דן",
│    customer_phone: "050123456789"
│  }
├─ Output (if not found): {found: false}
└─ Status: 200

POST /api/vehicles
├─ Input: {customer_id, license_plate, manufacturer, model, year}
├─ Auth: Manager, Secretary, Mechanic (כל אחד יכול ליצור רכב חדש בעת פתיחת כרטיס)
└─ Status: 201
```

---

```
GET /api/customers/search
├─ Query: ?phone=0501234567 OR ?license_plate=123456
├─ Output: [{id, full_name, phone_number, vehicles: [...]}]
└─ Status: 200

POST /api/customers
├─ Input: {full_name, phone_number}
├─ Output: {id, full_name, phone_number, ...}
├─ Auth: Manager, Secretary, Mechanic (אפילו Mechanic יכול ליצור)
└─ Status: 201

GET /api/customers/{id}
├─ Output: {id, full_name, phone_number, vehicles: [...]}
└─ Status: 200

PUT /api/customers/{id}
├─ Input: {full_name, phone_number, ...}
├─ Auth: Manager, Secretary
└─ Status: 200
```

---

### 4.3 Ticket Management

```
POST /api/tickets
├─ Input (אפשרות A: רכב קיים):
│  {
│    vehicle_id: 123,
│    assigned_mechanic_id: 5,
│    description: "החלפת בלמים",
│    parts: [{part_id: 1, quantity: 1}, ...]
│  }
│
├─ Input (אפשרות B: לקוח + רכב חדשים):
│  {
│    license_plate: "999-999",
│    new_customer: {
│      full_name: "דוד",
│      phone_number: "050987654321"
│    },
│    new_vehicle: {
│      manufacturer: "BMW",
│      model: "320i",
│      year: 2020
│    },
│    assigned_mechanic_id: 5,
│    description: "החלפת שמן",
│    parts: [{part_id: 1, quantity: 1}, ...]
│  }
│
├─ Process:
│  1. אם vehicle_id → השתמש בו
│  2. אם new_customer + new_vehicle → create customer, create vehicle, ואחרי זה קשר אותם
│  3. Validate parts availability
│  4. Create ticket
│  5. Deduct parts from inventory
│  6. Log to audit_log
│
├─ Output: {id, ticket_number, status: 'Pending', ...}
├─ Auth: Manager, Secretary, Mechanic
└─ Status: 201

GET /api/tickets
├─ Query: ?status=Pending OR ?mechanic_id=5 OR ?all=true
├─ Output (לפי role):
│  • Manager: כל הtickets
│  • Secretary: כל הtickets
│  • Mechanic: רק שלו (assigned_mechanic_id = user_id)
└─ Status: 200

PATCH /api/tickets/{id}/status
├─ Input: {new_status: 'In Progress' OR 'Completed'}
├─ Process:
│  • If 'In Progress': no confirmation needed
│    - Update status, set started_at = NOW()
│  • If 'Completed': 
│    - Requires confirmation (frontend dialog)
│    - Update status, set completed_at = NOW()
│    - Trigger: POST /api/notifications/whatsapp (internal)
├─ Auth: Manager, Secretary, Mechanic (שלו בלבד)
└─ Status: 200

GET /api/tickets/{id}
├─ Output: {id, ticket_number, vehicle, description, status, parts_used: [...], ...}
└─ Status: 200
```

---

### 4.4 Parts Management

```
GET /api/parts/compatible
├─ Query: ?manufacturer=Volkswagen&model=Golf&year=2018
├─ Process: חפש חלפים שה-year_start <= 2018
├─ Output: [{id, part_name, part_code, quantity_current}, ...]
├─ Note: מציג רק חלפים עם quantity_current > 0 בירוק
├─ Note: חלפים עם quantity_current = 0 בירוק אבל disabled
└─ Status: 200

POST /api/parts
├─ Input:
│  {
│    part_name: "בלמים דיסק קדמי",
│    part_code: "BREM001",
│    manufacturer: "Volkswagen",
│    model: "Golf",
│    year_start: 2015,
│    quantity_current: 12
│  }
├─ Auth: Manager, Secretary
└─ Status: 201

PUT /api/parts/{id}
├─ Input: {quantity_current: 10, ...}
├─ Auth: Manager, Secretary
└─ Status: 200

GET /api/parts/inventory
├─ Output: [כל החלפים עם inventory]
├─ Auth: Manager, Secretary (Mechanic לא רואה)
└─ Status: 200
```

---

### 4.5 Workflow (State Machine)

```
Backend Service: workflow.js

validateTransition(currentStatus, newStatus, userId, ticketId) {
  // בדוק transitions חוקיות
  if (currentStatus === 'Pending' && newStatus === 'In Progress') {
    return true;  // חוקי
  }
  if (currentStatus === 'In Progress' && newStatus === 'Completed') {
    return true;  // חוקי
  }
  if (currentStatus === 'Completed') {
    return false; // לא חוקי - כרטיס סגור
  }
  return false; // ללא transitions אחרות
}

authorizeStatusChange(userId, ticketId, newStatus) {
  // בדוק הרשאות
  user = getUserById(userId);
  ticket = getTicketById(ticketId);
  
  if (user.role === 'Manager') {
    return true; // Manager יכול לעדכן כל דבר
  }
  if (user.role === 'Secretary') {
    return true; // Secretary יכולה לעדכן כל דבר
  }
  if (user.role === 'Mechanic') {
    return ticket.assigned_mechanic_id === userId; // רק שלו
  }
  return false;
}
```

---

### 4.6 Admin Endpoints (Manager בלבד)

```
GET /api/admin/employees
├─ Output:
│  [{
│    id: 5,
│    name: "דוד",
│    role: "Mechanic",
│    online: true,
│    tickets_open: 3,
│    tickets_completed_today: 5,
│    last_login: "2026-06-02 08:00:00"
│  }, ...]
├─ Auth: Manager only
└─ Status: 200

GET /api/admin/tickets/summary
├─ Output:
│  {
│    total_pending: 5,
│    total_in_progress: 3,
│    total_completed: 8,
│    avg_completion_time: "4 hours 30 min"
│  }
├─ Auth: Manager only
└─ Status: 200

GET /api/admin/tickets/by-day
├─ Query: ?start_date=2026-05-01&end_date=2026-06-02
├─ Output:
│  [{
│    date: "2026-06-02",
│    tickets_created: 8,
│    tickets_completed: 6,
│    avg_time: "4:15"
│  }, ...]
├─ Auth: Manager only
└─ Status: 200

GET /api/admin/reports/performance
├─ Query: ?mechanic_id=5
├─ Output:
│  {
│    mechanic_name: "דוד",
│    total_work_hours: 40,
│    tickets_completed: 12,
│    tickets_easy: 8,
│    tickets_hard: 4,
│    avg_time_per_ticket: "3:20",
│    quality_score: 95
│  }
├─ Auth: Manager only
└─ Status: 200

POST /api/admin/users
├─ Input: {username, password, role: 'Manager'/'Secretary'/'Mechanic', full_name}
├─ Auth: Manager only
└─ Status: 201

DELETE /api/admin/users/{id}
├─ Auth: Manager only
└─ Status: 200
```

---

### 4.7 Notification Endpoint (Internal)

```
POST /api/notifications/whatsapp (Internal only - לא מFrontend)
├─ Trigger: כשticket.status = 'Completed'
├─ Input:
│  {
│    phone: "0501234567",
│    ticket_id: 123,
│    message: "הטיפול ברכבך הסתיים! ניתן להגיע לאיסוף"
│  }
├─ External API: WhatsApp Business API (Twilio/Meta)
├─ Response: {success: true, message_id: "xxx"}
└─ Error: log to database, notify Manager
```

---

## 5. End-to-End Workflows

### 5.1 Workflow: Mechanic פותח כרטיס - רכב קיים

```
1. Mechanic לוחץ: "כרטיס חדש"

2. Frontend: טופס עם שדה ראשון:
   ┌──────────────────────────────────┐
   │ הזן מספר רכב:  [_____________] │
   │                    [🔍 חפש]      │
   └──────────────────────────────────┘

3. Mechanic מזין: "123-456"
   - Frontend: GET /api/vehicles/search?license_plate=123-456

4. Backend מוצא את הרכב:
   {
     vehicle_id: 50,
     license_plate: "123-456",
     manufacturer: "Volkswagen",
     model: "Golf",
     year: 2018,
     customer_id: 10,
     customer_name: "דן",
     customer_phone: "050123456789"
   }

5. Frontend: Auto-fill של כל השדות:
   ┌──────────────────────────────────┐
   │ מספר רכב:     123-456 ✓          │
   │ לקוח:          דן ✓               │
   │ טלפון:         050123456789 ✓    │
   │ סוג רכב:       Volkswagen ✓      │
   │ מודל:          Golf ✓            │
   │ שנה:           2018 ✓            │
   │                                  │
   │ תיאור התקלה:  [_____________]   │
   │ בחירת חלפים:  [dropdown]        │
   │                                  │
   │        [פתח כרטיס]              │
   └──────────────────────────────────┘

6. Mechanic בוחר חלפים (compatible לGolf 2018)
   - Frontend: GET /api/parts/compatible?manufacturer=VW&model=Golf&year=2018
   - Return: רק חלפים שמתאימים + בחריות = 0

7. Mechanic לחץ "פתח כרטיס"
   - Frontend: POST /api/tickets
     {
       vehicle_id: 50,
       assigned_mechanic_id: 5,  // משתמש הנוכחי
       description: "החלפת בלמים",
       parts: [{part_id: 1, quantity: 1}]
     }

8. Backend:
   a. Validate: vehicle_id = 50 ✓, part בעל quantity > 0 ✓
   b. Create: INSERT into tickets_work
   c. Update: parts_inventory - deduct
   d. Log: INSERT into audit_log
   e. Return: {ticket_number: "TKT-001", status: 'Pending', ...}

9. Frontend: Kanban מעדכן
   - קלף חדש בעמודה Pending
   - הקלף מציג: "Golf 2018 - בלמים - דן"
```

---

### 5.1b Workflow: Mechanic פותח כרטיס - רכב חדש

```
1-3. [זהה ל-5.1]

4. Backend: רכב לא קיים
   {found: false}

5. Frontend: הצג טופס ליצירת לקוח + רכב חדשים:
   ┌──────────────────────────────────┐
   │ מספר רכב:     999-999 (נתון)    │
   │                                  │
   │ לקוח חדש:                        │
   │ שם:            [_____________]   │
   │ טלפון:         [_____________]   │
   │                                  │
   │ רכב חדש:                         │
   │ סוג:           [dropdown]        │
   │ מודל:          [_____________]   │
   │ שנה:           [_____________]   │
   │                                  │
   │ תיאור התקלה:  [_____________]   │
   │ בחירת חלפים:  [dropdown]        │
   │                                  │
   │        [פתח כרטיס]              │
   └──────────────────────────────────┘

6. Mechanic ממלא:
   - שם: "דוד"
   - טלפון: "050987654321"
   - סוג: "BMW"
   - מודל: "320i"
   - שנה: "2020"
   - תיאור: "החלפת שמן"
   - חלפים: (compatible לBMW 320i 2020)

7. Mechanic לחץ "פתח כרטיס"
   - Frontend: POST /api/tickets
     {
       license_plate: "999-999",
       new_customer: {
         full_name: "דוד",
         phone_number: "050987654321"
       },
       new_vehicle: {
         manufacturer: "BMW",
         model: "320i",
         year: 2020
       },
       assigned_mechanic_id: 5,
       description: "החלפת שמן",
       parts: [{part_id: 3, quantity: 1}]
     }

8. Backend:
   a. CREATE customer (דוד)
   b. CREATE vehicle (BMW 320i)
   c. CREATE ticket (קשר אותם)
   d. Deduct parts
   e. Log

9. Frontend: Kanban מעדכן
   - קלף חדש בעמודה Pending
   - הקלף מציג: "BMW 320i 2020 - שמן - דוד"
```

---

### 5.2 Workflow: Secretary פותחת כרטיס - רכב קיים

```
1. Secretary לוחץ: "כרטיס חדש"

2. Frontend: טופס עם שדה ראשון:
   ┌──────────────────────────────────┐
   │ הזן מספר רכב:  [_____________] │
   │                    [🔍 חפש]      │
   └──────────────────────────────────┘

3. Secretary מזינה: "123-456"
   - Frontend: GET /api/vehicles/search?license_plate=123-456
   - Backend מוצא: Golf של דן

4. Frontend: Auto-fill:
   - שם לקוח: דן ✓
   - טלפון: 050123456789 ✓
   - סוג רכב: Volkswagen ✓
   - מודל: Golf ✓
   - שנה: 2018 ✓

5. Secretary ממלא / בוחרת:
   - עובד מטפל: דוד (Mechanic)
   - תיאור: "החלפת בלמים ושמן"
   - בחירת חלפים: (compatible לGolf 2018)

6. Secretary לוחצת "פתח כרטיס"
   - POST /api/tickets
     {
       vehicle_id: 50,
       assigned_mechanic_id: 5,  // דוד
       description: "החלפת בלמים ושמן",
       parts: [{part_id: 1, quantity: 1}, {part_id: 3, quantity: 1}]
     }

7. Backend:
   - Create ticket
   - Deduct parts: בלמים 12→11, שמן 25→24
   - Log

8. Frontend:
   - Kanban של דוד מעודכן
   - קלף חדש בPending: "Golf 2018 - בלמים + שמן - דן"
```

---

### 5.2b Workflow: Secretary פותחת כרטיס - רכב חדש

```
[זהה ל-5.1b - Secretary יכולה גם ליצור לקוח + רכב חדשים]
```

---

### 5.3 Workflow: Kanban - עדכון סטטוס עם כפתורים

```
קלף בעמודה "Pending":
┌────────────────────────┐
│ Golf #123              │
│ החלפת בלמים           │
│ דוד                    │
│                        │
│    [קבל] ← כפתור      │
└────────────────────────┘

דוד לוחץ "קבל":
1. Frontend: PATCH /api/tickets/123/status
   {new_status: 'In Progress'}

2. Backend:
   a. validateTransition('Pending', 'In Progress') ✓
   b. authorizeStatusChange(user_id=5, ticket_id=123) ✓
   c. UPDATE tickets_work SET status='In Progress', started_at=NOW()
   d. Log: audit_log (action='status_changed', ...)

3. Frontend:
   - קלף זז אוטומטית מ"Pending" ל"In Progress"
   - כפתור משתנה ל-"סיים טיפול"

קלף בעמודה "In Progress":
┌────────────────────────┐
│ Golf #123              │
│ החלפת בלמים           │
│ דוד                    │
│                        │
│ [סיים טיפול] ← כפתור│
└────────────────────────┘

דוד לוחץ "סיים טיפול":
1. Frontend: מציג דיאלוג: "בטוח שרוצה לסיים?"
2. דוד לוחץ אישור
3. Frontend: PATCH /api/tickets/123/status
   {new_status: 'Completed', confirmation: true}

4. Backend:
   a. validateTransition('In Progress', 'Completed') ✓
   b. authorizeStatusChange(...) ✓
   c. UPDATE tickets_work SET status='Completed', completed_at=NOW()
   d. Trigger: POST /api/notifications/whatsapp
      {phone: '050...', message: "הטיפול הסתיים..."}
   e. Log: audit_log

5. Frontend:
   - קלף זז אוטומטית ל"Completed"
   - אין כפתורים יותר (כרטיס סגור)
   - Kanban מעדכן: מונה של Completed = Completed + 1

6. Backend (WhatsApp Service):
   - שולח הודעה ללקוח "דן": "הטיפול ברכבך הסתיים!"
```

---

## 6. Design Decisions (החלטות עיצוב)

### 6.1 State Machine (מדוע?)

**החלטה:** להשתמש בBackend State Machine בדל מתוך Frontend

**סיבות:**
- ✅ Security: ללא אפשרות לעקיפה (Frontend יכול לשנות אבל Backend חוסם)
- ✅ Consistency: כל transitions עוברים דרך אותו logic
- ✅ Audit Trail: כל שינוי נתעד

**Implementation:**
```javascript
// backend/services/workflow.js
const VALID_TRANSITIONS = {
  'Pending': ['In Progress'],
  'In Progress': ['Completed'],
  'Completed': []
};

async function updateTicketStatus(ticketId, newStatus, userId) {
  const ticket = await Ticket.findById(ticketId);
  
  // Validate transition
  if (!VALID_TRANSITIONS[ticket.status].includes(newStatus)) {
    throw new Error(`Invalid transition: ${ticket.status} → ${newStatus}`);
  }
  
  // Authorize
  if (!canUserUpdateTicket(userId, ticketId)) {
    throw new Error('Unauthorized');
  }
  
  // Update
  ticket.status = newStatus;
  if (newStatus === 'Completed') {
    ticket.completed_at = new Date();
    await notificationService.sendWhatsApp(ticket);
  }
  
  await ticket.save();
  await auditLog.create({user_id: userId, action: 'status_changed', ...});
}
```

---

### 6.2 Kanban עם כפתורים (לא Drag & Drop)

**החלטה:** כפתורים בלא גרירה

**סיבות:**
- ✅ Security: ברור מה קרה (כפתור ספציפי = action ספציפי)
- ✅ UX: עובד לא מחטיא קלף בגרירה טעות
- ✅ Mobile-ready: בעתיד כשנעשה responsive

**Frontend Implementation:**
```javascript
// frontend/components/Kanban.jsx
const Card = ({ticket}) => {
  if (ticket.status === 'Pending') {
    return (
      <button onClick={() => updateStatus(ticket.id, 'In Progress')}>
        קבל
      </button>
    );
  }
  if (ticket.status === 'In Progress') {
    return (
      <button onClick={() => showConfirmDialog(ticket.id)}>
        סיים טיפול
      </button>
    );
  }
  return null; // Completed - לא כפתורים
};
```

---

### 6.3 Parts Availability Validation

**החלטה:** למנוע פתיחת כרטיס אם אין חלף

**סיבות:**
- ✅ Prevents waste: לא מתחילים עבודה בלי חלף
- ✅ Transparency: עובד יודע מיד אם יש בעיה
- ✅ Simplicity: אין "מחוב" של חלפים

**Implementation:**
```javascript
// backend/services/ticket.js
async function createTicket(data) {
  // Validate parts availability
  for (const part of data.parts) {
    const partRecord = await Part.findById(part.part_id);
    if (partRecord.quantity_current < part.quantity) {
      throw new Error(`Part ${partRecord.part_name} not available`);
    }
  }
  
  // Create ticket...
  // Deduct parts...
}

// frontend - disable בחירה
const PartSelect = ({part}) => {
  const isDisabled = part.quantity_current === 0;
  return (
    <button disabled={isDisabled} style={{...}}>
      {part.name} ({part.quantity_current})
    </button>
  );
};
```

---

### 6.4 Secretary יכולה לעדכן סטטוסים

**החלטה:** Secretary לא רק פותחת, אלא גם יכולה לעדכן

**סיבות:**
- ✅ Flexibility: אם עובד לא זמין, Secretary יכולה להזיז
- ✅ Real-world: במוסכים בדיוני, מזכירה עושה דברים מלא
- ✅ No risk: יש audit trail של כל שינוי

---

### 6.5 Role-Based Permissions

**החלטה:** 3 Roles בלבד, כל אחד בהרשאות ברורות

**סיבות:**
- ✅ Simple: לא יותר מידי תפקידים
- ✅ Scalable: אפשר להוסיף roles בעתיד
- ✅ Clear: Manager יש הכל (superset)

---

## 7. Scalability Considerations (שיקולים להרחבה)

### 7.1 עומס גדול

**בעיה:** 100 כרטיסים ביום = Kanban איטי

**פתרון:**
- ✅ Add pagination: `GET /api/tickets?page=1&limit=50&status=Pending`
- ✅ Add caching: Redis for Kanban board
- ✅ WebSocket: Real-time updates במקום polling

**Implementation (תוכנית):**
```javascript
// Redis cache
const redis = require('redis').createClient();

async function getKanban(userId, role) {
  const cacheKey = `kanban:${role}:${userId}`;
  let data = await redis.get(cacheKey);
  
  if (!data) {
    data = await fetchFromDB(userId, role);
    redis.setex(cacheKey, 60, JSON.stringify(data));  // 60 sec TTL
  }
  return JSON.parse(data);
}

// WebSocket
io.on('connection', (socket) => {
  socket.on('ticket:status-changed', (ticketId, newStatus) => {
    // Broadcast to all users
    io.emit('ticket:updated', {ticketId, newStatus});
    redis.del(`kanban:*`);  // Invalidate cache
  });
});
```

---

### 7.2 מלאי ענק

**בעיה:** 100,000 חלפים = חיפוש איטי

**פתרון:**
- ✅ Index על (manufacturer, model, year)
- ✅ Elasticsearch for advanced search
- ✅ Pagination: `?page=1&limit=20`

---

### 7.3 מספר עובדים גדול

**בעיה:** 1000 עובדים = דוחות איטיים

**פתרון:**
- ✅ Background jobs: דוחות יוצרים בלילה
- ✅ Data warehouse: separate DB for analytics
- ✅ Aggregation: שמור statistics table

```javascript
// Nightly job
cron.schedule('0 2 * * *', async () => {
  // Generate daily reports
  const stats = await generateDailyStats();
  await DailyStats.create(stats);
});
```

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

```javascript
// Middleware
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({error: 'Unauthorized'});
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({error: 'Invalid token'});
  }
}

async function authorize(requiredRoles) {
  return (req, res, next) => {
    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({error: 'Forbidden'});
    }
    next();
  };
}

// Usage
app.patch('/api/tickets/:id/status', 
  authenticate,
  authorize(['Manager', 'Secretary', 'Mechanic']),
  updateTicketStatus
);
```

---

### 8.2 Data Validation

```javascript
// Input validation
const createTicketSchema = {
  vehicle_id: {required: true, type: 'number'},
  assigned_mechanic_id: {required: true, type: 'number'},
  description: {required: true, type: 'string', maxLength: 500},
  parts: {
    type: 'array',
    items: {
      part_id: {required: true, type: 'number'},
      quantity: {required: true, type: 'number', min: 1}
    }
  }
};

// Validate
const errors = validate(req.body, createTicketSchema);
if (errors.length) return res.status(400).json({errors});
```

---

### 8.3 SQL Injection Prevention

```javascript
// Parameterized queries (NOT string concatenation)
const sql = 'SELECT * FROM customers WHERE phone_number = ?';
const [customers] = await db.query(sql, [req.body.phone]);

// ORM (best)
const customers = await Customer.findAll({where: {phone_number: req.body.phone}});
```

---

## 9. Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│           Load Balancer (Nginx)                 │
│  מחלק traffic בין servers                       │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ App 1  │  │ App 2  │  │ App 3  │
    │ Node   │  │ Node   │  │ Node   │
    └────┬───┘  └────┬───┘  └────┬───┘
         │           │           │
         └───────────┼───────────┘
                     │
            ┌────────▼────────┐
            │   Database      │
            │  (PostgreSQL)   │
            │  - Primary      │
            │  - Replica      │
            └─────────────────┘

┌──────────────────────┐
│  Cache (Redis)       │
│  - Session tokens    │
│  - Kanban board      │
└──────────────────────┘

┌──────────────────────┐
│  WhatsApp API        │
│  (External)          │
└──────────────────────┘
```

---

## 10. Summary

**GarageClick v2.1** הוא מערכת ניהול מוסכים הבנויה על:

| היבט | פתרון |
|------|-------|
| **Architecture** | 3-Tier Monolith (עדיף לMVP) |
| **Backend** | Node.js/Express + 6 Services |
| **Database** | PostgreSQL + 7 טבלאות מנורמלות |
| **API** | REST + 40+ Endpoints |
| **Frontend** | Kanban עם כפתורים (לא גרירה) |
| **State Machine** | Backend-enforced transitions |
| **Permissions** | Role-based (Manager/Secretary/Mechanic) |
| **Real-time** | Updates < 2 seconds (עם Redis) |
| **Security** | JWT + SQL injection prevention |
| **Scalability** | Pagination, caching, background jobs |

---

**גרסה:** 2.1  
**סטטוס:** ✅ מוכן לפיתוח  
**תאריך עדכון:** יוני 2026
