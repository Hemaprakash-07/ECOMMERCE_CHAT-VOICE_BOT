# AI-Powered E-commerce Chat and Voice Bot for PC Components

## Overview
This project is an AI-powered e-commerce web application specializing in PC components. It features a fully functional e-commerce frontend integrated with an intelligent chat and voice bot. The chatbot supports bilingual communication (English and Tamil) and includes a voice bot with Text-To-Speech (TTS) capabilities for interactive user engagement. The backend handles product management, user authentication, orders, and interactions with the AI chatbot.

## Features
- **E-Commerce Frontend**: Comprehensive UI including Landing Page, Products, Shopping Cart, Orders & Returns, and Contact pages.
- **User Authentication**: Login, Registration, and Session Management.
- **Floating Chatbot & Voice Bot**: Persistent bot UI allowing real-time AI assistance.
- **Bilingual Support**: AI Chatbot supports English and Tamil logic seamlessly.
- **Voice Interactions**: Speech-to-text input and Text-to-Speech (TTS) output natively supporting English and Tamil.

## Tech Stack
- **Frontend**: HTML5, Vanilla CSS, JavaScript
- **Backend / API**: Python, Flask
- **Database**: MySQL (XAMPP / MariaDB)

## Project Structure
```text
.
├── database/          # Database schema (schema.sql)
├── src/               # Python source code
│   ├── routes/        # Flask API route definitions
│   └── utils/         # Utility functions and bot integrations
├── static/            # Static assets (CSS, JS, Images)
├── templates/         # HTML templates
├── app.py             # Main Flask application entry point
├── requirements.txt   # Python dependencies
└── .env               # Environment configuration (see .env.example)
```

## Setup Instructions

### 1. Database Setup
The application uses MySQL (MariaDB) provided by XAMPP.
1. Start the **MySQL** module in your XAMPP Control Panel.
2. Open phpMyAdmin (or your preferred MySQL client).
3. Create a new database named `ecommerce_chatbot`.
4. Import the provided schema from `database/schema.sql` to initialize the required tables: `users`, `categories`, `products`, `cart`, `orders`, `order_items`, `chat_logs`, and `faqs`.

### 2. Environment Variables
Create a `.env` file in the root directory based on the provided `.env.example`.
Configure your setup, particularly the database connection string and any required API keys for the chatbot functionality:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecommerce_chatbot
# Add application and AI keys here as well
```

### 3. Running the App
1. Ensure your Python virtual environment is activated:
   ```bash
   # Windows
   venv311\Scripts\activate
   ```
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask application:
   ```bash
   python app.py
   ```
The application will typically start running on `http://127.0.0.1:5000`.

## API Overview
The backend exposes robust RESTful endpoints serving the platform:
- **Products**: Fetching product catalog and category filters.
- **Cart & Orders**: Cart management and handling the order checkout flow.
- **Authentication**: User registration, login handling, and session checks.
- **Chatbot**: Endpoints processing user text queries and returning AI-generated responses.
- **Voice Bot**: Facilitates processing for the bilingual voice components.

## Chatbot and Voice Bot Features
- The chatbot operates as a resilient, floating widget on the frontend.
- Users can type queries normally or leverage their microphone to speak commands.
- The AI autonomously identifies whether the user is communicating in Tamil or English and responds appropriately in the same language.
- Responses can be read aloud using built-in, browser-based text-to-speech APIs, specially optimized to synthesize bilingual text.

## Language Support
- **English**: Full conversational awareness regarding products, cart actions, and PC components. 
- **Tamil**: Localized support addressing inquiries natively with appropriate AI prompt structures and generated speech output.

## Current Status
The robust e-commerce UI is flawlessly integrated with the Flask backend APIs. State management for users, products, and carts runs locally on XAMPP MySQL. The AI assistant acts as a persistent layer globally across the app serving queries via text and voice in two languages. 

## Future Improvements
- Refinement of context windows to reduce response latency.
- Injecting real-time transactional payment gateway simulations.
- Widening language support.
- Implementing advanced telemetry features and bot analytics.
