# MySQL CRUD Queries for Dinamica Raffle App

This document lists the essential SQL queries needed to interact with the `dinamica_raffle` database.

## 1. **Create a Sale (Transactional)**
This operation must be atomic. It involves creating/updating a customer, creating a sale, and inserting tickets.

```sql
START TRANSACTION;

-- Step 1: Upsert Customer (Create or Update if exists by Cedula)
INSERT INTO customers (cedula, firstName, lastName, email, phone, province, city)
VALUES ('1722222222', 'Juan', 'Perez', 'juan@mail.com', '0991234567', 'Pichincha', 'Quito')
ON DUPLICATE KEY UPDATE
    firstName = VALUES(firstName),
    lastName = VALUES(lastName),
    email = VALUES(email),
    phone = VALUES(phone),
    updatedAt = NOW();

-- Step 2: Get Customer ID
SET @custId = (SELECT id FROM customers WHERE cedula = '1722222222');

-- Step 3: Insert Sale
INSERT INTO sales (customerId, quantity, total, paymentMethod, paymentStatus)
VALUES (@custId, 2, 2.00, 'datafast', 'paid');

SET @saleId = LAST_INSERT_ID();

-- Step 4: Insert Tickets
INSERT INTO sale_tickets (saleId, ticketNumber) VALUES 
(@saleId, '0050'),
(@saleId, '0051');

COMMIT;
```

## 2. **Search Customers**
Find a customer by Cedula, Name, or Email.

```sql
SELECT * FROM customers 
WHERE cedula LIKE '%1722%' 
   OR CONCAT(firstName, ' ', lastName) LIKE '%Juan%' 
   OR email LIKE '%mail.com%';
```

## 3. **Get Dashboard Stats**
Retrieve total sales, tickets sold, and revenue for today.

```sql
SELECT 
    COUNT(id) as totalTransactions,
    SUM(quantity) as totalTicketsSold,
    SUM(total) as revenue
FROM sales
WHERE paymentStatus = 'paid'
AND DATE(createdAt) = CURDATE();
```

## 4. **Check if Ticket is Available**
Verify if a ticket number has already been sold.

```sql
SELECT count(*) as exists 
FROM sale_tickets t
JOIN sales s ON t.saleId = s.id
WHERE t.ticketNumber = '0050'
AND s.paymentStatus IN ('paid', 'pending');
```

## 5. **Pick a Winner (Randomly)**
Select a random ticket from all paid sales.

```sql
SELECT t.ticketNumber, s.id as saleId, c.id as customerId, c.firstName, c.lastName
FROM sale_tickets t
JOIN sales s ON t.saleId = s.id
JOIN customers c ON s.customerId = c.id
WHERE s.paymentStatus = 'paid'
ORDER BY RAND()
LIMIT 1;
```

## 6. **Register a Winner**
Once picked, save the winner to the history log.

```sql
INSERT INTO draws (winningTicket, saleId, customerId, notes)
VALUES ('0050', 105, 42, 'Sorteo Febrero 2026');
```
