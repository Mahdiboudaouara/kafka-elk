const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const { Kafka } = require('kafkajs');  // Import KafkaJS
const app = express();
const port = 3000;

// Parse application/json
app.use(bodyParser.json());

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'mahdi', // Replace with your MySQL username
    password: 'password', // Replace with your MySQL password
    database: 'mydb', // Name of your database
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});

// Set up Kafka
const kafka = new Kafka({
    clientId: 'user-service',  // Your Kafka client ID
    brokers: ['localhost:9092'],  // Your Kafka broker addresses
});

const producer = kafka.producer();

// Connect the Kafka producer
const connectProducer = async () => {
    await producer.connect();
    console.log('Kafka Producer connected');
};

// Send logs to Kafka
const sendToKafka = async (logMessage) => {
    try {
        await producer.send({
            topic: 'user-logs',
            messages: [
                {
                    value: JSON.stringify(logMessage),
                },
            ],
        });
        console.log('Log message sent to Kafka');
    } catch (error) {
        console.error('Error sending log message to Kafka:', error);
    }
};

// Sample /register endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Check if the username already exists
    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    
    db.query(checkQuery, [username], (err, results) => {
        if (err) {
            console.error('Error checking username:', err);
            res.status(500).send('Error checking username');
            return;
        }

        // If the user already exists
        if (results.length > 0) {
            console.log('User already exists:', username);
            res.status(400).send({ message: 'Username already exists' });
            return;
        }

        // Insert new user into the database if the username is available
        const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
        
        db.query(query, [username, password], (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                res.status(500).send('Error registering user');
            } else {
                console.log('User registered:', username);
                res.status(200).send({ message: 'User registered successfully' });
                // Log event and send to Kafka
                const logMessage = {
                    action: 'register',
                    status: 'success',
                    timestamp: new Date().toISOString(),
                    username,
                };
                sendToKafka(logMessage);  // Send log to Kafka
            }
        });
    });
});

// Sample /login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';

    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Error logging in user:', err);
            res.status(500).send('Error logging in');
        } else if (results.length > 0) {
            console.log('User logged in:', username);
            res.status(200).send({ message: 'Login successful' });
            // Log event and send to Kafka
            const logMessage = {
                action: 'login',
                status: 'success',
                timestamp: new Date().toISOString(),
                username,
            };
            sendToKafka(logMessage);  // Send log to Kafka
        } else {
            console.log('Failed login attempt:', username);
            res.status(401).send({ message: 'Invalid credentials' });
            // Log event and send to Kafka
            const logMessage = {
                action: 'login',
                status: 'failure',
                timestamp: new Date().toISOString(),
                username,
            };
            sendToKafka(logMessage);  // Send log to Kafka
        }
    });
});

// Sample /reset-password endpoint
app.post('/reset-password', (req, res) => {
    const { username, newPassword } = req.body;
    const query = 'UPDATE users SET password = ? WHERE username = ?';

    db.query(query, [newPassword, username], (err, result) => {
        if (err) {
            console.error('Error resetting password:', err);
            res.status(500).send('Error resetting password');
        } else {
            console.log('Password reset for user:', username);
            res.status(200).send({ message: 'Password reset successful' });
            // Log event and send to Kafka
            const logMessage = {
                action: 'reset-password',
                status: 'success',
                timestamp: new Date().toISOString(),
                username,
            };
            sendToKafka(logMessage);  // Send log to Kafka
        }
    });
});

// Home Route
app.get('/', (req, res) => {
    //res.send('Welcome to the User Management Service');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server and connect Kafka producer
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    connectProducer().catch(console.error);
});

