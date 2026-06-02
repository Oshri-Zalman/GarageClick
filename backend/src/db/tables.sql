-- ============================================================
-- GarageClick — Core table definitions (database-agnostic)
-- No CREATE DATABASE / USE here, so the same DDL can be applied
-- to the production DB or to an isolated test DB (garageclick_test).
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS with
-- inline indexes) so they can be re-run safely.
-- ============================================================

-- Table 1: users (system accounts with role-based permissions)
CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('Manager', 'Secretary', 'Mechanic') NOT NULL,
  full_name     VARCHAR(255),
  email         VARCHAR(100),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table 2: customers (vehicle owners)
CREATE TABLE IF NOT EXISTS customers (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  full_name     VARCHAR(255) NOT NULL,
  phone_number  VARCHAR(20)  NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_phone (phone_number)
) ENGINE=InnoDB;

-- Table 3: vehicles (owned by a customer)
-- license_plate is UNIQUE, which already creates an index used by plate search.
CREATE TABLE IF NOT EXISTS vehicles (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  customer_id   INT          NOT NULL,
  license_plate VARCHAR(20)  NOT NULL UNIQUE,
  manufacturer  VARCHAR(100) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  year          INT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vehicles_customer_id (customer_id),
  CONSTRAINT fk_vehicles_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 4: tickets_work (work tickets / Kanban cards)
-- ticket_number is human-facing (e.g. TKT-00001) and generated from the id.
-- status is enforced by the backend State Machine (workflow service).
CREATE TABLE IF NOT EXISTS tickets_work (
  id                        INT PRIMARY KEY AUTO_INCREMENT,
  ticket_number             VARCHAR(20) NOT NULL UNIQUE,
  vehicle_id                INT NOT NULL,
  created_by_id             INT NOT NULL,   -- who opened the ticket
  assigned_mechanic_id      INT NOT NULL,   -- which user works on it
  description               TEXT,
  status                    ENUM('Pending', 'In Progress', 'Completed')
                              NOT NULL DEFAULT 'Pending',
  estimated_completion_time DATETIME NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at                DATETIME NULL,  -- set on Pending -> In Progress
  completed_at              DATETIME NULL,  -- set on In Progress -> Completed
  INDEX idx_tickets_status (status),
  INDEX idx_tickets_mechanic (assigned_mechanic_id),
  CONSTRAINT fk_tickets_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
  CONSTRAINT fk_tickets_created_by
    FOREIGN KEY (created_by_id) REFERENCES users (id),
  CONSTRAINT fk_tickets_mechanic
    FOREIGN KEY (assigned_mechanic_id) REFERENCES users (id)
) ENGINE=InnoDB;
