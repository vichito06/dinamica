-- Database Schema for Dinamica Raffle App
-- Target Database: MySQL
-- Run this script in MySQL Workbench or via command line

CREATE DATABASE IF NOT EXISTS dinamica_raffle
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE dinamica_raffle;

-- ==========================================
-- 1. Customers Table
-- Identity based on unique 'cedula'.
-- ==========================================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cedula VARCHAR(15) NOT NULL UNIQUE, -- Primary business identifier
    firstName VARCHAR(80) NOT NULL,
    lastName VARCHAR(80) NOT NULL,
    email VARCHAR(120) NULL, -- Email is not unique per business rules
    phone VARCHAR(20) NULL,
    country VARCHAR(60) DEFAULT 'Ecuador',
    province VARCHAR(60) NULL,
    city VARCHAR(60) NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cedula (cedula),
    INDEX idx_fullname (lastName, firstName)
) ENGINE=InnoDB;

-- ==========================================
-- 2. Sales Table
-- Records a transaction.
-- ==========================================
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    saleCode VARCHAR(20) UNIQUE, -- Optional logic identifier (e.g. "1004")
    customerId INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paymentMethod VARCHAR(50) DEFAULT 'other', -- 'datafast', 'paypal', 'cash'
    paymentStatus ENUM('pending', 'paid', 'failed', 'refunded', 'canceled') DEFAULT 'pending',
    transactionId VARCHAR(100) NULL,
    emailSentAt DATETIME NULL, -- Track automated emails
    notes TEXT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sales_customer FOREIGN KEY (customerId) 
        REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        
    INDEX idx_sales_customer (customerId),
    INDEX idx_sales_created (createdAt),
    INDEX idx_sales_status (paymentStatus)
) ENGINE=InnoDB;

-- ==========================================
-- 3. Sale Tickets Table
-- Individual raffle numbers.
-- ==========================================
CREATE TABLE IF NOT EXISTS sale_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    saleId INT NOT NULL,
    ticketNumber VARCHAR(10) NOT NULL, -- Keep formatted (e.g. "0050")
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tickets_sale FOREIGN KEY (saleId) 
        REFERENCES sales(id) ON DELETE CASCADE ON UPDATE CASCADE,
        
    -- Unique constraint ensures a ticket is never sold twice
    UNIQUE KEY uq_ticket_number (ticketNumber),
    INDEX idx_tickets_sale (saleId)
) ENGINE=InnoDB;

-- ==========================================
-- 4. Settings Table
-- Global configuration (singleton row).
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1, -- Force single row
    raffleTitle VARCHAR(120),
    minNumber VARCHAR(10) DEFAULT '0001',
    maxNumber VARCHAR(10) DEFAULT '9999',
    contactEmail VARCHAR(120) DEFAULT 'soporteyvossoee@gmail.com',
    contactPhone VARCHAR(50) NULL,
    contactWhatsapp VARCHAR(50) NULL,
    contactText VARCHAR(255) NULL,
    termsHtml LONGTEXT,
    privacyHtml LONGTEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 5. Prizes Table
-- Configurable prizes for the frontend.
-- ==========================================
CREATE TABLE IF NOT EXISTS prizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position INT NOT NULL, -- 1, 2, 3
    title VARCHAR(120) NOT NULL,
    amount VARCHAR(50) NOT NULL, -- String to allow "$1000" formatting
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 6. Draws Table
-- Winner history log.
-- ==========================================
CREATE TABLE IF NOT EXISTS draws (
    id INT AUTO_INCREMENT PRIMARY KEY,
    drawDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    winningTicket VARCHAR(10) NOT NULL,
    saleId INT NULL,
    customerId INT NULL,
    notes VARCHAR(255) NULL,
    
    CONSTRAINT fk_draws_sale FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE SET NULL,
    CONSTRAINT fk_draws_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
    
    INDEX idx_draw_date (drawDate)
) ENGINE=InnoDB;

-- ==========================================
-- 7. Views
-- Utility views for easier querying.
-- ==========================================

-- View: Sales with Customer Details
CREATE OR REPLACE VIEW vw_sales_with_customer AS
SELECT 
    s.id AS saleId,
    s.saleCode,
    s.date AS saleDate,
    s.paymentStatus,
    s.paymentMethod,
    s.total,
    s.quantity,
    s.emailSentAt,
    c.id AS customerId,
    c.cedula,
    CONCAT(c.firstName, ' ', c.lastName) AS customerName,
    c.email AS customerEmail,
    c.phone AS customerPhone
FROM sales s
JOIN customers c ON s.customerId = c.id;

-- View: Customer Summary (Total Tickets & Sponsored Amount)
CREATE OR REPLACE VIEW vw_customers_summary AS
SELECT 
    c.id AS customerId,
    c.cedula,
    CONCAT(c.firstName, ' ', c.lastName) AS fullName,
    COUNT(s.id) AS salesCount,
    SUM(s.quantity) AS totalTickets,
    SUM(s.total) AS totalSpent,
    MAX(s.createdAt) AS lastPurchaseDate
FROM customers c
LEFT JOIN sales s ON c.id = s.customerId AND s.paymentStatus = 'paid'
GROUP BY c.id, c.cedula, c.firstName, c.lastName;
