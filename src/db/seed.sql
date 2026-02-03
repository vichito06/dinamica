-- Seed Data for Dinamica Raffle App
-- Run this AFTER schema.sql
USE dinamica_raffle;

-- 1. Initial Settings (ID = 1)
INSERT INTO settings (id, raffleTitle, minNumber, maxNumber, contactEmail, termsHtml, privacyHtml)
VALUES (
    1,
    'Dinámica 1 — Y Voss Oeee', 
    '0001', 
    '9999', 
    'yvossoeee2012@gmail.com',
    '<h2>Terminos y Condiciones</h2><p>Texto inicial...</p>',
    '<h2>Política de Privacidad</h2><p>Texto inicial...</p>'
) ON DUPLICATE KEY UPDATE id=1;

-- 2. Default Prizes
INSERT INTO prizes (position, title, amount) VALUES 
(1, 'Primer Premio', '$1000'),
(2, 'Segundo Premio', '$300'),
(3, 'Tercer Premio', '$100');

-- 3. (Optional) Dummy Customer for testing
-- INSERT INTO customers (cedula, firstName, lastName, email, phone) 
-- VALUES ('1799999999', 'Juan', 'Perez', 'juan@example.com', '0999999999');
