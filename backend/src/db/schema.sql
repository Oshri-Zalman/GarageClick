-- ============================================================
-- GarageClick — Core schema (Step 1)
-- Engine: MySQL 8.x (InnoDB, utf8mb4 for Hebrew support)
-- Covers: users, customers, vehicles
-- Tickets / parts / audit_log are added in later steps.
-- ============================================================

CREATE DATABASE IF NOT EXISTS garageclick
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE garageclick;

-- ------------------------------------------------------------
-- Table 1: users (system accounts with role-based permissions)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Table 2: customers (vehicle owners)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  full_name     VARCHAR(255) NOT NULL,
  phone_number  VARCHAR(20)  NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Fast lookup by phone (search endpoint in FR-1)
CREATE INDEX idx_customers_phone ON customers (phone_number);

-- ------------------------------------------------------------
-- Table 3: vehicles (owned by a customer)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  customer_id   INT          NOT NULL,
  license_plate VARCHAR(20)  NOT NULL UNIQUE,
  manufacturer  VARCHAR(100) NOT NULL,   -- e.g. Volkswagen, BMW
  model         VARCHAR(100) NOT NULL,   -- e.g. Golf, 320i
  year          INT,                     -- manufacture year, e.g. 2018
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicles_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Fast lookup by plate (the first step of opening a ticket, FR-2)
CREATE INDEX idx_vehicles_license_plate ON vehicles (license_plate);
CREATE INDEX idx_vehicles_customer_id   ON vehicles (customer_id);
