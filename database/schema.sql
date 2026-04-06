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
DROP PROCEDURE IF EXISTS _create_indexes;
DELIMITER //
CREATE PROCEDURE _create_indexes()
BEGIN
  DECLARE EXIT HANDLER FOR 1061 BEGIN END;
  CREATE INDEX idx_products_category ON products(category_id);
  CREATE INDEX idx_products_brand ON products(brand);
  CREATE INDEX idx_orders_number ON orders(order_number);
  CREATE INDEX idx_orders_session ON orders(session_id);
  CREATE INDEX idx_cart_session ON cart(session_id);
  CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);
  CREATE INDEX idx_chat_logs_created ON chat_logs(created_at);
END//
DELIMITER ;
CALL _create_indexes();
DROP PROCEDURE _create_indexes;

-- ============================================================
-- SCHEMA ADDITIONS — Safe to run on existing database
-- Added: keywords column, CSV products, FAQ dataset inserts
-- ============================================================

-- ----------------------------------------------------------
-- Add `keywords` column to faqs for faster chatbot search
-- Uses stored procedure to avoid error if column exists
-- ----------------------------------------------------------
DROP PROCEDURE IF EXISTS _add_faq_keywords;
DELIMITER //
CREATE PROCEDURE _add_faq_keywords()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'faqs'
          AND COLUMN_NAME  = 'keywords'
    ) THEN
        ALTER TABLE faqs ADD COLUMN keywords TEXT AFTER category;
    END IF;
END //
DELIMITER ;
CALL _add_faq_keywords();
DROP PROCEDURE IF EXISTS _add_faq_keywords;

-- ----------------------------------------------------------
-- Additional search index on products (text search)
-- ----------------------------------------------------------
DROP PROCEDURE IF EXISTS _add_product_idx;
DELIMITER //
CREATE PROCEDURE _add_product_idx()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'products'
          AND INDEX_NAME   = 'idx_products_name'
    ) THEN
        CREATE INDEX idx_products_name ON products(name(100));
    END IF;
END //
DELIMITER ;
CALL _add_product_idx();
DROP PROCEDURE IF EXISTS _add_product_idx;

-- ----------------------------------------------------------
-- NEW PRODUCTS FROM CSV DATASETS (INSERT IGNORE = safe re-run)
-- Uses existing category_ids: 1=CPU, 2=GPU, 3=RAM, 4=SSD,
--                             5=Motherboard, 6=PSU
-- ----------------------------------------------------------
INSERT IGNORE INTO products
  (category_id, brand, name, slug, description, specifications,
   selling_price, mrp, stock, image_url, rating, rating_count)
VALUES

-- ── CPUs ───────────────────────────────────────────────────
(1, 'AMD', 'Ryzen 5 3600', 'amd-ryzen5-3600',
 'AMD Zen2 6-core desktop processor — great value for gaming & productivity',
 '{"cores": 6, "threads": 12, "base_clock": "3.6GHz", "boost_clock": "4.2GHz", "tdp": "65W", "socket": "AM4", "cache": "32MB L3"}',
 8499, 9800, 20, NULL, 4.7, 4890),

(1, 'Intel', 'Core i5-12400F', 'intel-i5-12400f',
 'Intel 12th Gen Alder Lake 6-core processor — best budget gaming CPU',
 '{"cores": 6, "threads": 12, "base_clock": "2.5GHz", "boost_clock": "4.4GHz", "tdp": "65W", "socket": "LGA1700", "cache": "18MB L3"}',
 10999, 13008, 18, NULL, 4.8, 6720),

(1, 'AMD', 'Ryzen 9 5900X', 'amd-ryzen9-5900x',
 'AMD Zen3 12-core flagship for workstations and content creation',
 '{"cores": 12, "threads": 24, "base_clock": "3.7GHz", "boost_clock": "4.8GHz", "tdp": "105W", "socket": "AM4", "cache": "64MB L3"}',
 29999, 34890, 6, NULL, 4.9, 3210),

(1, 'AMD', 'Ryzen 7 5700G', 'amd-ryzen7-5700g',
 'AMD Zen3 APU with Radeon Vega graphics — no separate GPU needed',
 '{"cores": 8, "threads": 16, "base_clock": "3.8GHz", "boost_clock": "4.6GHz", "tdp": "65W", "socket": "AM4", "cache": "16MB L3", "igpu": "Radeon Vega 8"}',
 15999, 18699, 14, NULL, 4.6, 2890),

(1, 'AMD', 'Ryzen 7 5800X', 'amd-ryzen7-5800x',
 'AMD Zen3 8-core gaming processor — top single-threaded performance on AM4',
 '{"cores": 8, "threads": 16, "base_clock": "3.8GHz", "boost_clock": "4.7GHz", "tdp": "105W", "socket": "AM4", "cache": "32MB L3"}',
 20999, 23499, 9, NULL, 4.8, 3560),

(1, 'Intel', 'Core i7-12700F', 'intel-i7-12700f',
 'Intel 12th Gen 12-core hybrid architecture for demanding workloads',
 '{"cores": 12, "threads": 20, "base_clock": "2.1GHz", "boost_clock": "4.9GHz", "tdp": "65W", "socket": "LGA1700", "cache": "25MB L3"}',
 24499, 27399, 8, NULL, 4.7, 1980),

-- ── GPUs ───────────────────────────────────────────────────
(2, 'ZOTAC', 'RTX 3060 Twin Edge OC 12GB', 'zotac-rtx3060-twin-edge-oc',
 'NVIDIA Ampere architecture — excellent 1080p & 1440p gaming GPU',
 '{"vram": "12GB GDDR6", "cuda_cores": 3584, "boost_clock": "1.78GHz", "tdp": "170W", "connector": "PCIe 4.0 x16"}',
 27499, 30000, 12, NULL, 4.6, 5120),

(2, 'GIGABYTE', 'RTX 3050 Windforce OC 8GB', 'gigabyte-rtx3050-windforce-oc',
 'Entry-level Ampere GPU — perfect 1080p gaming with DLSS support',
 '{"vram": "8GB GDDR6", "cuda_cores": 2560, "boost_clock": "1.78GHz", "tdp": "130W", "connector": "PCIe 4.0 x16"}',
 21499, 23890, 16, NULL, 4.4, 2340),

(2, 'MSI', 'Radeon RX 6600 MECH 2X 8G', 'msi-rx6600-mech-2x-8g',
 'AMD RDNA2 GPU — great 1080p performance with 8GB GDDR6',
 '{"vram": "8GB GDDR6", "compute_units": 28, "boost_clock": "2.49GHz", "tdp": "132W", "connector": "PCIe 4.0 x8"}',
 30999, 34999, 10, NULL, 4.5, 1780),

(2, 'MSI', 'RTX 3070 Ventus 3X Plus 8G OC', 'msi-rtx3070-ventus-3x-plus',
 'High-end Ampere GPU for 1440p gaming with excellent DLSS performance',
 '{"vram": "8GB GDDR6", "cuda_cores": 5888, "boost_clock": "1.80GHz", "tdp": "220W", "connector": "PCIe 4.0 x16"}',
 52999, 57999, 5, NULL, 4.7, 1230),

(2, 'ZOTAC', 'RTX 4060 Twin Edge OC 8GB', 'zotac-rtx4060-twin-edge-oc',
 'Ada Lovelace GPU with DLSS 3 — great 1080p gaming value',
 '{"vram": "8GB GDDR6", "cuda_cores": 3072, "boost_clock": "2.46GHz", "tdp": "115W", "connector": "PCIe 4.0 x16"}',
 29499, 33261, 14, NULL, 4.6, 2870),

(2, 'ASUS', 'RTX 4070 SUPER Dual OC 12GB', 'asus-rtx4070-super-dual-oc',
 'Mid-high Ampere successor — excellent 1440p and 4K gaming performance',
 '{"vram": "12GB GDDR6X", "cuda_cores": 7168, "boost_clock": "2.51GHz", "tdp": "220W", "connector": "PCIe 4.0 x16"}',
 44999, 52999, 7, NULL, 4.8, 980),

-- ── RAM ────────────────────────────────────────────────────
(3, 'XPG', 'GAMMIX D30 DDR4 16GB 3200MHz', 'xpg-gammix-d30-ddr4-16gb',
 'High-performance DDR4 gaming RAM with heat spreader',
 '{"capacity": "16GB (1x16GB)", "type": "DDR4", "speed": "3200MHz", "cl": "CL16", "voltage": "1.35V"}',
 2799, 3290, 30, NULL, 4.5, 3860),

(3, 'Corsair', 'Vengeance LPX DDR4 16GB 3200MHz', 'corsair-vengeance-lpx-ddr4-16gb',
 'Low-profile DDR4 kit — compatible with most CPU coolers',
 '{"capacity": "16GB (2x8GB)", "type": "DDR4", "speed": "3200MHz", "cl": "CL16", "voltage": "1.35V"}',
 3299, 3979, 22, NULL, 4.7, 7420),

(3, 'Crucial', 'DDR5 4800MHz 16GB', 'crucial-ddr5-4800-16gb',
 'Reliable DDR5 upgrade — Micron chips, excellent stability',
 '{"capacity": "16GB (1x16GB)", "type": "DDR5", "speed": "4800MHz", "cl": "CL40", "voltage": "1.1V"}',
 4599, 5500, 15, NULL, 4.5, 1750),

(3, 'G.Skill', 'Ripjaws V DDR4 16GB 3200MHz', 'gskill-ripjaws-v-ddr4-16gb',
 'Classic DDR4 gaming kit with stylish red heat spreader',
 '{"capacity": "16GB (2x8GB)", "type": "DDR4", "speed": "3200MHz", "cl": "CL16", "voltage": "1.35V"}',
 2999, 3600, 25, NULL, 4.6, 5890),

-- ── SSDs ───────────────────────────────────────────────────
(4, 'Samsung', '870 EVO SATA 500GB', 'samsung-870-evo-500gb',
 'Reliable 2.5" SATA SSD — fast boot drives and OS installs',
 '{"capacity": "500GB", "interface": "SATA III", "read": "560 MB/s", "write": "530 MB/s", "form_factor": "2.5 inch"}',
 2999, 3709, 28, NULL, 4.8, 9120),

(4, 'WD', 'Blue SN570 NVMe 1TB', 'wd-blue-sn570-1tb',
 'PCIe 3.0 NVMe M.2 SSD — great everyday performance at budget price',
 '{"capacity": "1TB", "interface": "PCIe 3.0 NVMe M.2", "read": "3500 MB/s", "write": "3000 MB/s", "form_factor": "M.2 2280"}',
 3499, 4299, 24, NULL, 4.6, 4340),

(4, 'Kingston', 'A400 SATA SSD 480GB', 'kingston-a400-480gb',
 'Budget SATA SSD — great value for PC upgrades and laptop storage',
 '{"capacity": "480GB", "interface": "SATA III", "read": "500 MB/s", "write": "450 MB/s", "form_factor": "2.5 inch"}',
 1999, 2500, 40, NULL, 4.4, 11230),

(4, 'Crucial', 'BX500 SATA 1TB', 'crucial-bx500-1tb',
 '3D NAND SATA SSD for budget builds — reliable everyday storage',
 '{"capacity": "1TB", "interface": "SATA III", "read": "540 MB/s", "write": "500 MB/s", "form_factor": "2.5 inch"}',
 3699, 4202, 30, NULL, 4.5, 6780),

(4, 'Samsung', '980 Pro NVMe 1TB', 'samsung-980-pro-1tb',
 'PCIe 4.0 NVMe flagship SSD with up to 7000MB/s sequential read',
 '{"capacity": "1TB", "interface": "PCIe 4.0 NVMe M.2", "read": "7000 MB/s", "write": "5000 MB/s", "form_factor": "M.2 2280"}',
 7499, 9099, 15, NULL, 4.8, 4560),

(4, 'WD', 'Black SN770 NVMe 1TB', 'wd-black-sn770-1tb',
 'PCIe 4.0 gaming NVMe SSD — fast, affordable Gen4 storage',
 '{"capacity": "1TB", "interface": "PCIe 4.0 NVMe M.2", "read": "5150 MB/s", "write": "4900 MB/s", "form_factor": "M.2 2280"}',
 4299, 5169, 18, NULL, 4.7, 2870),

-- ── Motherboards ───────────────────────────────────────────
(5, 'ASUS', 'Prime B550M-K', 'asus-prime-b550m-k',
 'Micro-ATX AM4 motherboard — solid B550 for Ryzen 5000 builds',
 '{"socket": "AM4", "chipset": "B550", "form_factor": "mATX", "memory_slots": 4, "max_memory": "128GB DDR4", "pcie_slots": "1x PCIe 4.0"}',
 8999, 10384, 12, NULL, 4.5, 1890),

(5, 'MSI', 'B550M Pro-VDH WiFi', 'msi-b550m-pro-vdh-wifi',
 'Feature-rich B550 mATX board with built-in WiFi for Ryzen builds',
 '{"socket": "AM4", "chipset": "B550", "form_factor": "mATX", "memory_slots": 4, "max_memory": "128GB DDR4", "pcie_slots": "1x PCIe 4.0", "wifi": "WiFi 5"}',
 11299, 12999, 9, NULL, 4.6, 2140),

(5, 'GIGABYTE', 'B650M K AM5', 'gigabyte-b650m-k',
 'Budget AMD AM5 motherboard for Ryzen 7000 series processors',
 '{"socket": "AM5", "chipset": "B650", "form_factor": "mATX", "memory_slots": 4, "max_memory": "192GB DDR5", "pcie_slots": "1x PCIe 5.0"}',
 13199, 14500, 8, NULL, 4.4, 980),

(5, 'ASRock', 'B550 Pro4 ATX', 'asrock-b550-pro4',
 'Full ATX B550 board with PCIe 4.0 and dual M.2 slots for Ryzen 5000',
 '{"socket": "AM4", "chipset": "B550", "form_factor": "ATX", "memory_slots": 4, "max_memory": "128GB DDR4", "pcie_slots": "2x PCIe 4.0/3.0"}',
 8299, 9389, 11, NULL, 4.5, 1560),

(5, 'ASUS', 'TUF Gaming B550-PLUS', 'asus-tuf-gaming-b550-plus',
 'Durable ATX B550 gaming board with enhanced VRMs for Ryzen 5000',
 '{"socket": "AM4", "chipset": "B550", "form_factor": "ATX", "memory_slots": 4, "max_memory": "128GB DDR4", "pcie_slots": "2x PCIe 4.0/3.0"}',
 13499, 15926, 7, NULL, 4.7, 2230),

-- ── PSUs ───────────────────────────────────────────────────
(6, 'Cooler Master', 'MWE 450 Bronze V2', 'coolermaster-mwe-450-bronze-v2',
 '450W 80+ Bronze certified PSU — reliable power for budget builds',
 '{"wattage": "450W", "efficiency": "80+ Bronze", "modular": "Non-Modular", "form_factor": "ATX"}',
 2899, 3349, 25, NULL, 4.4, 4230),

(6, 'EVGA', '750 BR 80+ Bronze 750W', 'evga-750br-80plus-bronze',
 'EVGA 750W semi-modular PSU with 10-year warranty support',
 '{"wattage": "750W", "efficiency": "80+ Bronze", "modular": "Semi-Modular", "form_factor": "ATX"}',
 5299, 5999, 14, NULL, 4.5, 1890),

(6, 'Thermaltake', 'Smart BX1 650W', 'thermaltake-smart-bx1-650w',
 '650W 80+ Bronze PSU with active PFC and quiet fan profile',
 '{"wattage": "650W", "efficiency": "80+ Bronze", "modular": "Non-Modular", "form_factor": "ATX"}',
 4999, 5799, 16, NULL, 4.3, 2110),

(6, 'Cooler Master', 'MWE Gold V2 FM 750W', 'coolermaster-mwe-gold-750w',
 '750W 80+ Gold fully modular PSU — premium efficiency for gaming builds',
 '{"wattage": "750W", "efficiency": "80+ Gold", "modular": "Fully Modular", "form_factor": "ATX"}',
 7999, 9449, 10, NULL, 4.6, 1650),

(6, 'ASUS', 'TUF Gaming 650B 650W', 'asus-tuf-gaming-650b',
 '650W 80+ Bronze PSU with ASUS TUF military-grade components',
 '{"wattage": "650W", "efficiency": "80+ Bronze", "modular": "Semi-Modular", "form_factor": "ATX"}',
 7299, 8340, 8, NULL, 4.6, 1340);

-- ----------------------------------------------------------
-- FAQ DATASET INSERTS (from Ecommerce_FAQ_Chatbot_dataset.json)
-- Uses NOT EXISTS guard — idempotent, safe to re-run
-- ----------------------------------------------------------
INSERT INTO faqs (question, answer, category, keywords)
SELECT question, answer, category, keywords FROM (
  SELECT 'How can I create an account?' AS question,
    'To create an account, click on the Sign Up button on the top right corner of our website and follow the instructions to complete the registration process.' AS answer,
    'account' AS category, 'account register sign up create' AS keywords
  UNION ALL SELECT 'How can I track my order?',
    'You can track your order by logging into your account and navigating to the Order History section. There, you will find the tracking information for your shipment.',
    'orders', 'track order history shipment'
  UNION ALL SELECT 'Do you offer international shipping?',
    'Yes, we offer international shipping to select countries. The availability and shipping costs will be calculated during the checkout process based on your location.',
    'shipping', 'international shipping abroad countries'
  UNION ALL SELECT 'What should I do if my package is lost or damaged?',
    'If your package is lost or damaged during transit, please contact our customer support team immediately. We will initiate an investigation and take the necessary steps to resolve the issue.',
    'shipping', 'lost damaged package transit'
  UNION ALL SELECT 'Can I change my shipping address after placing an order?',
    'If you need to change your shipping address, please contact our customer support team as soon as possible. We will do our best to update the address if the order has not been shipped yet.',
    'orders', 'change address shipping'
  UNION ALL SELECT 'How can I contact customer support?',
    'You can contact our customer support team by phone at +91 800 123 4567 or by email at support@nexpc.in. Our team is available Monday to Saturday, 9 AM to 8 PM IST to assist you.',
    'general', 'contact support phone email'
  UNION ALL SELECT 'Do you offer gift wrapping services?',
    'Yes, we offer gift wrapping services for an additional fee. During the checkout process, you can select the option to add gift wrapping to your order.',
    'general', 'gift wrap package'
  UNION ALL SELECT 'What is your price matching policy?',
    'We have a price matching policy where we will match the price of an identical product found on a competitor website. Please contact our customer support team with the details of the product and the competitor offer.',
    'payment', 'price match competitor'
  UNION ALL SELECT 'Can I order by phone?',
    'Unfortunately, we do not accept orders over the phone. Please place your order through our website for a smooth and secure transaction.',
    'orders', 'phone order call'
  UNION ALL SELECT 'Are my personal and payment details secure?',
    'Yes, we take the security of your personal and payment details seriously. We use industry-standard 256-bit SSL encryption and follow strict security protocols to ensure your information is protected.',
    'payment', 'security ssl encrypt safe'
  UNION ALL SELECT 'What is your price adjustment policy?',
    'If a product you purchased goes on sale within 7 days of your purchase, we offer a one-time price adjustment. Please contact our customer support team with your order details to request the adjustment.',
    'payment', 'price adjustment sale'
  UNION ALL SELECT 'Do you have a loyalty program?',
    'Yes, we have a loyalty program where you can earn points for every purchase. These points can be redeemed for discounts on future orders. Please visit our website to learn more and join.',
    'general', 'loyalty reward points discount'
  UNION ALL SELECT 'Can I order without creating an account?',
    'Yes, you can place an order as a guest without creating an account. However, creating an account offers benefits such as order tracking and easier future purchases.',
    'account', 'guest order no account'
  UNION ALL SELECT 'Do you offer bulk or wholesale discounts?',
    'Yes, we offer bulk or wholesale discounts for certain products. Please contact our customer support team or reach out via email for more information and to discuss your specific requirements.',
    'payment', 'bulk wholesale discount'
  UNION ALL SELECT 'Can I change or cancel an item in my order?',
    'If you need to change or cancel an item in your order, please contact our customer support team as soon as possible. We will assist you with the necessary steps.',
    'orders', 'change cancel item order'
  UNION ALL SELECT 'How can I leave a product review?',
    'To leave a product review, navigate to the product page on our website and click on the Write a Review button. You can share your feedback and rating based on your experience.',
    'products', 'review feedback rating write'
  UNION ALL SELECT 'Can I use multiple promo codes on a single order?',
    'Usually only one promo code can be applied per order. During the checkout process, enter the promo code in the designated field to apply the discount.',
    'payment', 'promo code coupon discount'
  UNION ALL SELECT 'What should I do if I receive the wrong item?',
    'If you receive the wrong item in your order, please contact our customer support team immediately. We will arrange for the correct item to be shipped to you and assist with returning the wrong item.',
    'returns', 'wrong item incorrect product'
  UNION ALL SELECT 'Do you offer expedited shipping?',
    'Yes, we offer expedited shipping options for faster delivery. During the checkout process, you can select the desired expedited shipping method. Express delivery reaches metro cities in 1-2 business days.',
    'shipping', 'expedited express fast shipping'
  UNION ALL SELECT 'Can I order a product that is out of stock?',
    'If a product is currently out of stock, you may see an option to sign up for product notifications. This way, you will be alerted when the product becomes available again.',
    'availability', 'out of stock unavailable'
  UNION ALL SELECT 'Can I return a product if I changed my mind?',
    'Yes, you can return a product if you changed your mind within 30 days of purchase. Please ensure the product is in its original condition and packaging, and refer to our return policy for instructions.',
    'returns', 'return change mind'
  UNION ALL SELECT 'Do you offer live chat support?',
    'Yes, we offer AI-powered live chat support 24/7 through our chatbot at the bottom-right corner of the page. For human support, our team is available Monday to Saturday, 9 AM to 8 PM IST.',
    'general', 'live chat support 24 7'
  UNION ALL SELECT 'Can I order a product as a gift?',
    'Yes, you can order a product as a gift and have it shipped directly to the recipient. During the checkout process, you can enter the recipient shipping address and add a gift message.',
    'general', 'gift order recipient'
  UNION ALL SELECT 'What should I do if my discount code is not working?',
    'If your discount code is not working, please double-check the terms and conditions associated with the code. Ensure it has not expired and applies to your cart items. If the issue persists, contact our support team.',
    'payment', 'discount code not working promo error'
  UNION ALL SELECT 'Can I return a product if it was a final sale item?',
    'Final sale items are usually non-returnable and non-refundable. Please review the product description before purchasing or contact our customer support team to confirm return eligibility.',
    'returns', 'final sale non returnable'
  UNION ALL SELECT 'Do you offer installation services for your products?',
    'We do not currently offer physical installation services. However, our AI chatbot can guide you through PC component installation steps, and we provide detailed manuals for all products.',
    'products', 'installation service setup'
  UNION ALL SELECT 'Can I return a product without a receipt?',
    'Your order number serves as your receipt. You can find it in your account under Order History, or in the order confirmation email. Contact our support team with this information for returns.',
    'returns', 'return receipt proof purchase'
  UNION ALL SELECT 'Can I request a custom order or personalized product?',
    'We do not currently offer custom orders or personalized products. However, our AI chatbot can help you configure the perfect PC build from our available components based on your requirements.',
    'products', 'custom order personalized'
  UNION ALL SELECT 'Can I return a product if it was damaged during shipping?',
    'If your product was damaged during shipping, please contact our customer support team immediately with photos of the damage. We will guide you through the return and replacement process at no extra cost.',
    'returns', 'damaged shipping return replacement'
  UNION ALL SELECT 'Can I return a product if it was purchased during a sale or with a discount?',
    'Yes, you can return a product purchased during a sale or with a discount. The refund will be processed based on the amount you actually paid after the discount was applied.',
    'returns', 'return sale discount refund'
  UNION ALL SELECT 'Can I request a product repair or replacement if it is damaged?',
    'If you receive a damaged product, please contact our customer support team immediately with photos. We will assist you with repair under warranty or arrange a full replacement within 7 days of delivery.',
    'returns', 'repair replacement damaged warranty'
  UNION ALL SELECT 'Can I return a product if it was purchased as a gift?',
    'Yes, you can return a product purchased as a gift within 30 days. Refunds will typically be issued to the original payment method used for the purchase.',
    'returns', 'return gift refund'
  UNION ALL SELECT 'Can I return a product if it was purchased with a gift card?',
    'Yes, you can return a product purchased with a gift card. The refund will be issued in the form of store credit or a new gift card of equal value.',
    'returns', 'return gift card store credit'
  UNION ALL SELECT 'Can I return a product if it was purchased with a discount code?',
    'Yes, you can return a product purchased with a discount code. The refund will be processed based on the amount paid after the discount.',
    'returns', 'return discount code refund'
  UNION ALL SELECT 'Can I return a product if it was purchased during a promotional event?',
    'Yes, you can return a product purchased during a promotional event within 30 days. The refund will be processed based on the amount paid after any applicable discounts.',
    'returns', 'return promotional event discount'
  UNION ALL SELECT 'Can I return a product if it was damaged due to improper use?',
    'Our return policy covers products that are defective or damaged upon arrival. Damage caused by improper use, accidental drops, or mishandling may not be eligible for a return. Contact our support team for assistance.',
    'returns', 'damaged improper use return policy'
  UNION ALL SELECT 'Can I return a product if it was a clearance or final sale item?',
    'Clearance or final sale items are typically non-returnable and non-refundable. Please review the product description carefully before purchasing.',
    'returns', 'clearance final sale return'
  UNION ALL SELECT 'Can I return a product that is a bundle or set?',
    'If a product was purchased as part of a bundle or set, all items in the bundle must be returned together. Please contact our support team for specific return instructions.',
    'returns', 'bundle set return'
  UNION ALL SELECT 'Can I order a product listed as coming soon?',
    'Products listed as coming soon are not yet available for purchase. You can sign up for notifications on the product page to be alerted the moment it becomes available.',
    'availability', 'coming soon pre order notify'
  UNION ALL SELECT 'Can I order a product listed as backordered?',
    'Products listed as backordered are temporarily out of stock but can still be ordered. Your order will be fulfilled and shipped once the product is restocked, usually within 7-14 business days.',
    'availability', 'backordered out of stock backorder'
  UNION ALL SELECT 'Can I order a product listed as pre-order with other in-stock items?',
    'Yes, you can place an order with a mix of pre-order and in-stock items. However, the entire order will be shipped together once all pre-order items become available.',
    'availability', 'pre order stock mix'
  UNION ALL SELECT 'Can I request a product that is out of stock to be reserved?',
    'We do not offer product reservations. However, you can sign up for stock notifications on the product page. You will receive an email as soon as the item is available again.',
    'availability', 'reserve out of stock notification'
  UNION ALL SELECT 'Can I return a product if it was purchased with store credit?',
    'Yes, you can return a product purchased with store credit. The refund will be re-issued as store credit which you can use for future purchases.',
    'returns', 'store credit return refund'
  UNION ALL SELECT 'Can I request an invoice for my order?',
    'Yes, a digital invoice is automatically generated for every order and sent to your registered email. You can also download it from the Order History section in your account.',
    'orders', 'invoice receipt download order'
  UNION ALL SELECT 'Can I order a product if it is listed as sold out?',
    'If a product is listed as sold out, it is currently unavailable. Please sign up for product notifications to be alerted when stock is replenished.',
    'availability', 'sold out unavailable stock'
  UNION ALL SELECT 'What is your email newsletter about?',
    'Our email newsletter covers new product arrivals, exclusive deals, build guides, and helpful PC component tips. You can subscribe on our website homepage.',
    'general', 'newsletter email subscribe deals'
) AS dataset
WHERE NOT EXISTS (
    SELECT 1 FROM faqs f WHERE f.question = dataset.question
);

-- ----------------------------------------------------------
-- Update keywords for existing FAQs (best-effort)
-- ----------------------------------------------------------
UPDATE faqs SET keywords = 'return policy 30 day exchange'      WHERE question LIKE '%return policy%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'shipping time delivery days'        WHERE question LIKE '%shipping%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'warranty years manufacturer'        WHERE question LIKE '%warranty%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'OEM retail box genuine'             WHERE question LIKE '%OEM%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'track order shipment number'        WHERE question LIKE '%track%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'EMI installment credit card'        WHERE question LIKE '%EMI%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'cancel order 24 hours'              WHERE question LIKE '%cancel%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'compatibility CPU motherboard socket' WHERE question LIKE '%compatibility%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'payment UPI cards netbanking COD'   WHERE question LIKE '%payment methods%' AND keywords IS NULL;
UPDATE faqs SET keywords = 'custom build PC recommendation'     WHERE question LIKE '%custom PC%' AND keywords IS NULL;

