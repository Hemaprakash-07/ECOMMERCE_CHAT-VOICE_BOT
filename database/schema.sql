-- ============================================================
-- E-commerce Chat & Voice Bot — MySQL Database Schema
-- Project: PC Components Store with AI Customer Support
-- ============================================================

CREATE DATABASE IF NOT EXISTS ecommerce_chatbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecommerce_chatbot;

-- ----------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    phone         VARCHAR(20),
    address       TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active     BOOLEAN DEFAULT TRUE
);

-- ----------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon        VARCHAR(50) DEFAULT '🖥️'
);

-- Insert PC Component Categories
INSERT IGNORE INTO categories (name, slug, description, icon) VALUES
('CPU / Processors',  'cpu',         'Desktop and laptop processors from Intel & AMD',             '🔲'),
('Graphics Cards',    'gpu',         'NVIDIA & AMD desktop and workstation GPUs',                  '🎮'),
('RAM / Memory',      'ram',         'DDR4 and DDR5 desktop and laptop memory modules',            '💾'),
('SSD / Storage',     'ssd',         'SATA, NVMe M.2 SSDs and external drives',                   '💿'),
('Motherboards',      'motherboard', 'ATX, mATX, ITX motherboards for all sockets',               '🖳'),
('Power Supplies',    'psu',         'Modular and non-modular PSUs from 450W to 1600W',            '⚡'),
('CPU Coolers',       'cooler',      'Air and liquid cooling solutions',                           '❄️'),
('PC Cases',          'case',        'Mid-tower, full-tower, and mini-ITX cases',                  '🗄️');

-- ----------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    category_id     INT NOT NULL,
    brand           VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    specifications  JSON,
    selling_price   DECIMAL(10,2) NOT NULL,
    mrp             DECIMAL(10,2) NOT NULL,
    discount_pct    INT GENERATED ALWAYS AS (ROUND((mrp - selling_price) / mrp * 100)) STORED,
    stock           INT DEFAULT 10,
    image_url       VARCHAR(500),
    rating          DECIMAL(3,2) DEFAULT 4.0,
    rating_count    INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Sample PC Products
INSERT IGNORE INTO products (category_id, brand, name, slug, description, specifications, selling_price, mrp, stock, image_url, rating, rating_count) VALUES
-- CPUs
(1, 'Intel', 'Core i9-14900K', 'intel-i9-14900k',
 'Intel 14th Gen Core i9 flagship desktop processor',
 '{"cores": 24, "threads": 32, "base_clock": "3.2GHz", "boost_clock": "6.0GHz", "tdp": "125W", "socket": "LGA1700", "cache": "36MB L3"}',
 39999, 54999, 8, '/static/images/products/intel_i9_cpu_1774786291030.png', 4.8, 1240),

(1, 'AMD', 'Ryzen 9 7950X', 'amd-ryzen9-7950x',
 'AMD Zen4 flagship desktop processor for high-end workstations',
 '{"cores": 16, "threads": 32, "base_clock": "4.5GHz", "boost_clock": "5.7GHz", "tdp": "170W", "socket": "AM5", "cache": "64MB L3"}',
 44999, 59999, 5, '/static/images/products/amd_ryzen_cpu_1774786323928.png', 4.9, 876),

(1, 'AMD', 'Ryzen 5 7600X', 'amd-ryzen5-7600x',
 'Best mid-range gaming CPU with Zen4 architecture',
 '{"cores": 6, "threads": 12, "base_clock": "4.7GHz", "boost_clock": "5.3GHz", "tdp": "105W", "socket": "AM5", "cache": "32MB L3"}',
 18999, 24999, 15, '/static/images/products/amd_5.jpg', 4.7, 2134),

(1, 'Intel', 'Core i5-13600K', 'intel-i5-13600k',
 'Intel 13th Gen Core i5 best-in-class mid-range gaming CPU',
 '{"cores": 14, "threads": 20, "base_clock": "3.5GHz", "boost_clock": "5.1GHz", "tdp": "125W", "socket": "LGA1700", "cache": "24MB L3"}',
 21999, 29999, 12, '/static/images/products/inteli5.jpg', 4.7, 3422),

-- GPUs
(2, 'NVIDIA', 'RTX 4090', 'nvidia-rtx-4090',
 'NVIDIA Ada Lovelace flagship GPU for 4K gaming and AI workloads',
 '{"vram": "24GB GDDR6X", "cuda_cores": 16384, "boost_clock": "2.52GHz", "tdp": "450W", "connector": "PCIe 4.0 x16"}',
 149999, 189999, 3, '/static/images/products/rtx_4090_gpu_1774786347377.png', 4.9, 532),

(2, 'NVIDIA', 'RTX 4070 Ti SUPER', 'nvidia-rtx-4070ti-super',
 'High-end 1440p and 4K gaming GPU with DLSS 3',
 '{"vram": "16GB GDDR6X", "cuda_cores": 8448, "boost_clock": "2.61GHz", "tdp": "285W", "connector": "PCIe 4.0 x16"}',
 79999, 99999, 7, '/static/images/products/rtx_4070_tisuper.jpg', 4.8, 891),

(2, 'AMD', 'Radeon RX 7900 XTX', 'amd-rx-7900xtx',
 'AMD RDNA3 flagship GPU, excellent 4K gaming performance',
 '{"vram": "24GB GDDR6", "compute_units": 96, "boost_clock": "2.5GHz", "tdp": "355W", "connector": "PCIe 4.0 x16"}',
 84999, 109999, 5, '/static/images/products/radeon7900.png', 4.7, 643),

(2, 'NVIDIA', 'RTX 4060', 'nvidia-rtx-4060',
 'Best 1080p gaming GPU under budget with DLSS 3 support',
 '{"vram": "8GB GDDR6", "cuda_cores": 3072, "boost_clock": "2.46GHz", "tdp": "115W", "connector": "PCIe 4.0 x16"}',
 27999, 34999, 20, '/static/images/products/rtx_4060_gpu_1774786408409.png', 4.6, 4120),

-- RAM
(3, 'Corsair', 'Vengeance DDR5 32GB Kit', 'corsair-vengeance-ddr5-32gb',
 '2x16GB DDR5-5200 with low-profile heatspreader',
 '{"capacity": "32GB (2x16GB)", "type": "DDR5", "speed": "5200MHz", "cl": "CL38", "voltage": "1.25V"}',
 8999, 12999, 25, '/static/images/products/corsair_ram_1774786374552.png', 4.7, 1890),

(3, 'G.Skill', 'Trident Z5 RGB 32GB', 'gskill-tridentz5-32gb',
 '2x16GB DDR5-6000 high-performance gaming RAM with RGB',
 '{"capacity": "32GB (2x16GB)", "type": "DDR5", "speed": "6000MHz", "cl": "CL36", "voltage": "1.35V"}',
 10999, 15999, 18, '/static/images/products/gskillram32t.jpg', 4.8, 987),

(3, 'Kingston', 'Fury Beast DDR4 16GB', 'kingston-fury-beast-ddr4-16gb',
 '2x8GB DDR4-3200 budget-friendly gaming RAM',
 '{"capacity": "16GB (2x8GB)", "type": "DDR4", "speed": "3200MHz", "cl": "CL16", "voltage": "1.35V"}',
 3499, 4999, 40, '/static/images/products/furyram16.jpg', 4.5, 6730),

-- SSDs
(4, 'Samsung', '990 Pro NVMe 1TB', 'samsung-990-pro-1tb',
 'PCIe 4.0 NVMe SSD with up to 7450MB/s sequential read speed',
 '{"capacity": "1TB", "interface": "PCIe 4.0 NVMe M.2", "read": "7450 MB/s", "write": "6900 MB/s", "form_factor": "M.2 2280"}',
 8999, 12999, 30, '/static/images/products/samsung.jpg', 4.9, 3241),

(4, 'WD', 'Black SN850X 2TB', 'wd-black-sn850x-2tb',
 'PCIe 4.0 NVMe SSD optimized for gaming with 7300MB/s reads',
 '{"capacity": "2TB", "interface": "PCIe 4.0 NVMe M.2", "read": "7300 MB/s", "write": "6600 MB/s", "form_factor": "M.2 2280"}',
 14999, 19999, 20, '/static/images/products/WD_BLACK.jpg', 4.8, 1567),

(4, 'Crucial', 'MX500 SATA SSD 1TB', 'crucial-mx500-1tb',
 'Reliable SATA SSD for budget builds and secondary storage',
 '{"capacity": "1TB", "interface": "SATA III", "read": "560 MB/s", "write": "510 MB/s", "form_factor": "2.5 inch"}',
 4999, 6999, 35, '/static/images/products/crucialssd.jpg', 4.6, 8901),

-- Motherboards
(5, 'ASUS', 'ROG Strix Z790-E Gaming WiFi', 'asus-rog-strix-z790e',
 'Intel Z790 ATX motherboard with WiFi 6E and DDR5 support',
 '{"socket": "LGA1700", "chipset": "Z790", "form_factor": "ATX", "memory_slots": 4, "max_memory": "128GB DDR5", "pcie_slots": "3x PCIe 5.0/4.0"}',
 34999, 44999, 8, '/static/images/products/asus-rog-strix-z790e.jpg', 4.8, 643),

(5, 'MSI', 'MAG X670E Tomahawk WiFi', 'msi-mag-x670e-tomahawk',
 'AMD X670E ATX motherboard with PCIe 5.0 and WiFi 6E',
 '{"socket": "AM5", "chipset": "X670E", "form_factor": "ATX", "memory_slots": 4, "max_memory": "128GB DDR5", "pcie_slots": "2x PCIe 5.0/4.0"}',
 27999, 35999, 10, '/static/images/products/mb-msi-x670e-tomahawk.jpg', 4.7, 523);

-- ----------------------------------------------------------
-- 4. CART TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    session_id  VARCHAR(100) NOT NULL,
    user_id     INT,
    product_id  INT NOT NULL,
    quantity    INT DEFAULT 1,
    added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------
-- 5. ORDERS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    session_id      VARCHAR(100),
    user_id         INT,
    customer_name   VARCHAR(100),
    customer_email  VARCHAR(150),
    customer_phone  VARCHAR(20),
    shipping_address TEXT,
    subtotal        DECIMAL(10,2) NOT NULL,
    tax_amount      DECIMAL(10,2) NOT NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    payment_method  ENUM('cod','upi','card','netbanking') DEFAULT 'cod',
    payment_status  ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
    order_status    ENUM('placed','confirmed','processing','shipped','delivered','cancelled','return_requested','returned') DEFAULT 'placed',
    tracking_number VARCHAR(100),
    placed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------
-- 6. ORDER ITEMS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    product_id  INT NOT NULL,
    product_name VARCHAR(255),
    brand       VARCHAR(100),
    quantity    INT NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------
-- 7. CHAT LOGS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    session_id  VARCHAR(100) NOT NULL,
    user_id     INT,
    role        ENUM('user','bot') NOT NULL,
    message     TEXT NOT NULL,
    language    VARCHAR(10) DEFAULT 'en',
    intent      VARCHAR(100),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------
-- 8. FAQS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    category    VARCHAR(100) DEFAULT 'general',
    is_active   BOOLEAN DEFAULT TRUE
);

INSERT IGNORE INTO faqs (question, answer, category) VALUES
('What is your return policy?',
 'We offer a 30-day hassle-free return policy on all PC components. Items must be in original packaging and unused condition. Defective items can be exchanged within 7 days.',
 'returns'),
('How long does shipping take?',
 'Standard shipping takes 3-5 business days. Express shipping (1-2 days) is available for an additional fee. Metro cities usually receive orders within 2 business days.',
 'shipping'),
('Do you offer warranty on products?',
 'Yes! All products come with manufacturer warranty: CPUs 3 years, GPUs 3 years, RAM lifetime warranty, SSDs 5 years, Motherboards 3 years.',
 'warranty'),
('Are the products OEM or retail box?',
 'We sell only genuine retail box products with full manufacturer warranty. No OEM or grey-market products.',
 'products'),
('How do I track my order?',
 'Once your order is shipped, you will receive an email with a tracking number. You can also ask our chatbot: "Track my order ORD-XXXXX".',
 'orders'),
('Do you offer EMI options?',
 'Yes, EMI is available on orders above ₹5,000 through major credit cards (6/12/24 months). No-cost EMI available for orders above ₹15,000.',
 'payment'),
('Can I cancel my order?',
 'Orders can be cancelled within 24 hours of placement if not yet shipped. After shipment, you will need to initiate a return once delivered.',
 'orders'),
('Is CPU and motherboard compatibility guaranteed?',
 'Our AI chatbot can check compatibility before purchase. Generally, Intel CPUs use LGA1700 (Z790/B760) and AMD CPUs use AM5 (X670/B650) sockets.',
 'compatibility'),
('What payment methods do you accept?',
 'We accept UPI, Credit/Debit Cards, Net Banking, and Cash on Delivery. All online payments are secured with 256-bit SSL encryption.',
 'payment'),
('Do you build custom PCs?',
 'Yes! Our AI assistant can recommend compatible components for a complete custom PC build based on your budget and use case (gaming, workstation, etc.).',
 'products');

-- ----------------------------------------------------------
-- Indexes for Performance
-- ----------------------------------------------------------
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_cart_session ON cart(session_id);
CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX idx_chat_logs_created ON chat_logs(created_at);
