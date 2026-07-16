# GarageClick

GarageClick is a modern garage management system designed to replace outdated and cumbersome workflows with a clear, convenient, and more efficient digital interface. The system allows a garage to manage service tickets, customers, vehicles, employees, spare parts inventory, and ticket archives — all in one place, with functionality tailored to the different roles within the garage.

The system includes a Hebrew RTL user interface, designed for the daily work of managers, secretaries, and mechanics. Through the interface, users can create work tickets, track ticket statuses on a work board, select spare parts that are compatible with a vehicle, manage customers and vehicles, update inventory, view a dashboard, and manage users.

---

## Technical Overview

From a technical perspective, the system is divided into three main parts: **Frontend**, **Backend**, and **Database**.

### Frontend

The Frontend was built using:

- **React**
- **TypeScript**
- **Vite**
- **Tailwind CSS**

On the Frontend side, several key mechanisms were implemented:

- **Role-Based UI** — the interface changes according to the user's role: Manager, Secretary, or Mechanic.
- **Work Board State Flow** — tickets move between statuses such as Pending, In Progress, Completed, and Archived.
- **Reusable Components** — shared components for forms, tables, modals, status badges, error messages, and data filtering.

### Backend

The Backend was built using:

- **Python**
- **FastAPI**
- **REST API**

On the Backend side, several key mechanisms were implemented:

- **Authentication & Authorization** — user login and role-based permissions.
- **Ticket Lifecycle Management** — creating tickets, updating their status, completing them, and archiving them.
- **Parts Compatibility & Inventory Logic** — matching spare parts to vehicles, checking inventory availability, supporting universal parts, and updating stock quantities.

### Database

The data is stored in a relational database that contains the main information of the system, including:

- Users and roles
- Customers
- Vehicles
- Work tickets and statuses
- Spare parts and inventory
- Part-to-vehicle compatibility
- Archive data
- Basic reports

---

## Project Authors

The project was developed by **Tal Eliya** and **Oshri Zalman** as part of the **“Introduction to Software Engineering”** course during the second year of the **Computer and Software Engineering** degree.

---

![GarageClick Screenshot](docs/images/garageclick.png)