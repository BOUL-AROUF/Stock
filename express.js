// express.js
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const app = express();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage(),});

app.use(cors({ origin: "https://stock.biozagora.com", credentials: true }));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "https://stock.biozagora.com");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});
const pool = mysql.createPool({
  host: 'blb7dojcqkcztbntoks9-mysql.services.clever-cloud.com',
  user: 'u8zdpw1qpnddy38e', // The MySQL user you created
  password: 'FaHlKnuGMLdV85EdMu1s', // The password you set
  database: 'blb7dojcqkcztbntoks9', // Your database name
  port: 3306, // MySQL default port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
module.exports = pool.promise();
// Use express-session
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Parse incoming request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
})
app.use(express.static(path.join(__dirname, 'src')));

// Your login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const query = 'SELECT username, role, store FROM stock_login WHERE username = ? AND password = ?';
    pool.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = results[0];
        console.log("User data from DB:", user); // ✅ Debugging log

        res.json({
            message: 'Login successful!',
            role: user.role,
            store: user.store // Make sure store is being sent in the response
        });
    });
});



// Add this to your Express route file (main.js or other route handler file)
app.post('/logout', (req, res) => {
    // Destroy the session or remove the JWT token from the cookies/local storage
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }

        // Redirect to the login page or send success response
        res.json({ message: 'Logged out successfully!' });
    });
});

// Route to handle saving orders
app.post('/save-orders', (req, res) => {
    const orders = req.body.orders;

    // Insert each order into the database
    orders.forEach(order => {
        const query = 'INSERT INTO orders (store, serie, produit, quantite, date) VALUES (?, ?, ?, ?, ?)';
        pool.query(query, [order.store, order.serie, order.produit, order.quantite, order.date], (err, result) => {
            if (err) {
                console.error('Error inserting order:', err);
                res.status(500).json({ success: false, message: 'Error inserting order' });
            }
        });
    });

    res.json({ success: true, message: 'Orders have been saved!' });
});

app.get('/get-orders', (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const query = `
        SELECT store, serie, produit, quantite, DATE_FORMAT(date, '%d.%m.%Y') AS date
        FROM orders 
        WHERE date = ?
        ORDER BY FIELD(store, 'Rabat', 'Tanger', 'Salé', 'Kénitra', 'Laayoune')`;

    pool.query(query, [today], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Database error", error: err });
        }

        // Adjust the date in case it's in UTC
        results.forEach(order => {
            const localDate = new Date(order.date);
            order.formatted_date = `${localDate.getDate().toString().padStart(2, '0')}.${(localDate.getMonth() + 1).toString().padStart(2, '0')}.${localDate.getFullYear()}`;
        });

        // Group orders by store
        const groupedOrders = results.reduce((acc, order) => {
            if (!acc[order.store]) acc[order.store] = [];
            acc[order.store].push(order);
            return acc;
        }, {});

        res.json({ success: true, orders: groupedOrders });
    });
});

app.get('/get-orders-2', (req, res) => {
    const filterDate = req.query.date;
    let query;
    
    if (filterDate) {
        // Convert the filterDate into a format MySQL can compare directly (YYYY-MM-DD)
        query = `
            SELECT store, serie, produit, quantite, DATE_FORMAT(date, '%d.%m.%Y') AS date
            FROM orders 
            WHERE DATE_FORMAT(date, '%Y-%m-%d') = ? 
            ORDER BY FIELD(store, 'Rabat', 'Tanger', 'Salé', 'Kénitra', 'Laayoune')`;
    } else {
        query = `
            SELECT store, serie, produit, quantite, DATE_FORMAT(date, '%d.%m.%Y') AS date
            FROM orders 
            ORDER BY FIELD(store, 'Rabat', 'Tanger', 'Salé', 'Kénitra', 'Laayoune')`;
    }

    pool.query(query, filterDate ? [filterDate] : [], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: "Database error", error: err });
        }

        const groupedOrders = results.reduce((acc, order) => {
            if (!acc[order.store]) acc[order.store] = [];
            acc[order.store].push(order);
            return acc;
        }, {});

        res.json({ success: true, orders: groupedOrders });
    });
});


// API to get product article by barcode
app.get('/get-article', (req, res) => {
    const { barcode } = req.query;

    if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
    }

    const sql = "SELECT article FROM products WHERE code = ?";
    pool.query(sql, [barcode], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (result.length > 0) {
            res.json({ article: result[0].article });
        } else {
            res.json({ article: null });
        }
    });
});


app.get('/user-orders', (req, res) => {
    const { store, date } = req.query;

    if (!store || !date) {
        return res.status(400).json({ error: 'Missing store or date parameter' });
    }

    // Query the database based on the store and date
    const query = `
        SELECT serie, produit, quantite, DATE_FORMAT(date, '%d.%m.%Y') AS date
        FROM orders
        WHERE store = ? AND DATE(date) = ?
    `;

    pool.query(query, [store, date], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }

        res.json({ orders: results });
    });
});

const moment = require('moment');

app.post('/save-invoice', upload.single('file'), (req, res) => {
    const { store, date } = req.body;
    const invoiceFile = req.file;

    if (!invoiceFile) {
        return res.status(400).send({ message: 'No file uploaded.' });
    }

    // Convert the date to the proper format for MySQL (YYYY-MM-DD HH:mm:ss)
    const formattedDate = moment(date, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

    const query = 'INSERT INTO invoices (store, date, file) VALUES (?, ?, ?)';
    pool.query(query, [store, formattedDate, invoiceFile.buffer], (err, result) => {
        if (err) {
            console.error('Error saving invoice to database:', err);
            return res.status(500).send({ message: 'Failed to save invoice to database.' });
        }

        res.status(200).send({
            message: 'Invoice saved successfully in the database',
            store,
            date: formattedDate,
        });
    });
});


app.get('/get-invoices', (req, res) => {
    const { date } = req.query;

    let query = 'SELECT store, date, file FROM invoices';
    const queryParams = [];

    // Add a date filter if provided
    if (date) {
        query += ' WHERE DATE(date) = ?';
        queryParams.push(date);
    }

    pool.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching invoices:', err);
            return res.status(500).send({ message: 'Failed to fetch invoices.' });
        }

        // Format the date and convert the file to a base64 string
        const formattedInvoices = results.map(invoice => {
            const formattedDate = moment(invoice.date).format('DD-MM-YYYY HH:mm:ss');
            
            // Convert the binary file data to a base64 string
            const fileBase64 = invoice.file.toString('base64');

            return {
                store: invoice.store,
                date: formattedDate,
                file: fileBase64, // Send the file as a base64 string
                filename: `invoice_${invoice.store}_${formattedDate}.pdf` // Suggest a filename for download
            };
        });

        // Send the list of formatted invoices to the frontend
        res.json({ invoices: formattedInvoices });
    });
});

// Start the Express server
app.listen(3000, () => {
    console.log('Express server running on http://localhost:3000');
});
