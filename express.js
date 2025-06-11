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
const router = express.Router();
const excel = require('exceljs');


// Middleware
app.use(cors({
    origin: ('http://localhost:3000','https://expressed-east-magnificent-whom.trycloudflare.com/'),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));


const pool = mysql.createPool({
    host: "31.170.164.153",
    user: "u764605078_root",
    password: "AbBa@2002####",
    database: "u764605078_railway",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,           // Reduced from 15 to 10 for stability
    queueLimit: 0,
    connectTimeout: 60000,         // Increased to 60 seconds
    acquireTimeout: 60000,         // Increased to 60 seconds
    timeout: 120000,               // Increased to 120 seconds
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,  // 30 seconds
    
    // Additional settings for large queries/files
    multipleStatements: false,     // Security measure
    maxPreparedStatements: 100,
    charset: 'utf8mb4',
    
    // MySQL server config (for handling large data)
    flags: [
        // Add flags that might help with large queries
        '-FOUND_ROWS',
        '+IGNORE_SPACE'
    ]
});

// Add a connection error handler to the pool
pool.on('error', (err) => {
    console.error('Unexpected database error on idle client:', err);
    process.exit(-1); // In a production environment, you might want to handle this differently
});

// Add a connection acquire handler for debugging
pool.on('acquire', (connection) => {
    console.log('Connection %d acquired', connection.threadId);
});

// Add a connection release handler for debugging
pool.on('release', (connection) => {
    console.log('Connection %d released', connection.threadId);
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


// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.promise().query('SELECT ID_ARTICLE, Code, Designation, Famille, Fornisseur, Prix_Achat, Prix_Vente, Stock FROM Products');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

//last id route
app.get('/api/articles/last-id', async (req, res) => {
    try {
      const [rows] = await pool.promise().query('SELECT MAX(ID_ARTICLE) AS lastID FROM Products');
      const lastID = rows[0].lastID || 0;
      res.json({ lastID });
    } catch (err) {
      console.error('Error fetching last ID:', err);
      res.status(500).json({ error: 'Failed to fetch last ID' });
    }
});

// Add new product
app.post('/api/products', async (req, res) => {
    const { id_article, code, designation, famille, fornisseur, prix_achat, prix_vente, stock } = req.body;
    
    try {
        const [result] = await pool.promise().query(
            'INSERT INTO Products (ID_ARTICLE, Code, Designation, Famille, Fornisseur, Prix_Achat, Prix_Vente, Stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id_article, code, designation, famille, fornisseur, prix_achat, prix_vente, stock]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du produit' });
    }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { code, designation, famille, fornisseur, prix_achat, prix_vente, stock } = req.body;
    
    try {
        await pool.promise().query(
            'UPDATE Products SET Code = ?, Designation = ?, Famille = ?, Fornisseur = ?, Prix_Achat = ?, Prix_Vente = ?, Stock = ? WHERE ID_ARTICLE = ?',
            [code, designation, famille, fornisseur, prix_achat, prix_vente, stock, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
    }
});

// Delete product(s)
app.delete('/api/products', async (req, res) => {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs invalides' });
    }
    
    try {
        await pool.promise().query('DELETE FROM Products WHERE ID_ARTICLE IN (?)', [ids]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la suppression des produits' });
    }
});

// Export to Excel
app.get('/api/products/export', async (req, res) => {
    try {
        const [rows] = await pool.promise().query('SELECT Code, Designation AS Article, Famille, Prix_Vente AS PRIX_V, Stock FROM Products');
        
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Produits');
        
        // Add headers
        worksheet.columns = [
            { header: 'Code', key: 'Code', width: 15 },
            { header: 'Article', key: 'Article', width: 30 },
            { header: 'Famille', key: 'Famille', width: 20 },
            { header: 'Prix (MAD)', key: 'PRIX_V', width: 12 },
            { header: 'Stock', key: 'Stock', width: 10 },
            { header: 'Statut', key: 'Statut', width: 12 }
        ];
        
        // Add rows
        rows.forEach(product => {
            const statut = product.Stock > 0 ? 'En stock' : 'Rupture';
            worksheet.addRow({
                ...product,
                Statut: statut
            });
        });
        
        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=produits.xlsx'
        );
        
        // Send the workbook
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de l\'exportation' });
    }
});

// Restock product
app.put('/api/products/:id/restock', async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Quantité de réapprovisionnement invalide' });
    }
    
    try {
        await pool.promise().query(
            'UPDATE Products SET Stock = Stock + ? WHERE ID_ARTICLE = ?',
            [parseInt(amount), id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors du réapprovisionnement du produit' });
    }
});

// Get product statistics for charts
app.get('/api/products/stats', async (req, res) => {
    try {
        // Category distribution
        const [categoryStats] = await pool.promise().query(
            'SELECT Famille as category, COUNT(*) as count FROM Products GROUP BY Famille'
        );
        
        // Stock status
        const [stockStats] = await pool.promise().query(
            'SELECT CASE WHEN Stock > 0 THEN "En Stock" ELSE "Rupture" END as status, COUNT(*) as count FROM Products GROUP BY status'
        );
        
        // Price distribution
        const [priceStats] = await pool.promise().query(
            'SELECT CASE WHEN Prix_Vente < 20 THEN "0-20 MAD" WHEN Prix_Vente BETWEEN 20 AND 50 THEN "20-50 MAD" WHEN Prix_Vente BETWEEN 50 AND 100 THEN "50-100 MAD" ELSE "100+ MAD" END as \`range\`, COUNT(*) as count FROM Products GROUP BY \`range\`'
        );
        
        res.json({
            categories: categoryStats,
            stockStatus: stockStats,
            priceRanges: priceStats
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Endpoint to get product IDs by names
app.post('/api/get-product-ids', async (req, res) => {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
        return res.status(400).json({ success: false, message: 'Invalid products array' });
    }
    
    try {
        // Using parameterized query to prevent SQL injection
        const query = 'SELECT ID_ARTICLE, Designation FROM Products WHERE Designation IN (?)';
        const [rows] = await pool.promise().query(query, [products]);
        
        res.json({ 
            success: true, 
            products: rows 
        });
    } catch (err) {
        console.error('Error fetching product IDs:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database error',
            error: err.message 
        });
    }
});

// Endpoint to record product movements
app.post('/api/record-movements', async (req, res) => {
    const { movements } = req.body;
    
    if (!movements || !Array.isArray(movements)) {
        return res.status(400).json({ success: false, message: 'Invalid movements data' });
    }
    
    try {
        // Prepare values for batch insert
        const values = movements.map(m => [
            m.ID_ARTICLE,
            m.mouvement_type,
            m.quantity,
            m.store,
            m.destination,
            m.reason,
            m.date
        ]);
        
        // Batch insert
        const query = `INSERT INTO product_movements 
            (id_article, movement_type, quantity, store, destination, reason, Date) 
            VALUES ?`;
            
        const [result] = await pool.promise().query(query, [values]);
        
        res.json({ 
            success: true, 
            insertedCount: result.affectedRows 
        });
    } catch (err) {
        console.error('Error recording movements:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database error',
            error: err.message 
        });
    }
});


app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Get counts in a single query
        const [stats] = await pool.promise().query(`
            SELECT 
                (SELECT COUNT(*) FROM Products) as totalProducts,
                (SELECT COUNT(*) FROM Products WHERE Stock <= 0) as outOfStock,
                (SELECT COUNT(*) FROM orders WHERE DATE(date) = CURDATE()) as todayOrders,
                (SELECT SUM(Stock) FROM Products) as totalInventory
        `);
        
        res.json(stats[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/dashboard/sales-trend', async (req, res) => {
    try {
        const { store } = req.query;
        let query = `
            SELECT 
                DATE_FORMAT(date, '%Y-%m-%d') as day,
                COUNT(*) as count
            FROM orders
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        `;
        
        if (store && store !== 'all') {
            query += ` AND store = ? GROUP BY day ORDER BY day`;
            const [results] = await pool.promise().query(query, [store]);
            res.json(results);
        } else {
            query += ` GROUP BY day ORDER BY day`;
            const [results] = await pool.promise().query(query);
            res.json(results);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
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

// GET products with stock status
app.get('/get-products', (req, res) => {
    const { search, page = 1, status } = req.query;
    const itemsPerPage = 10;
    const offset = (page - 1) * itemsPerPage;

    let query = `
        SELECT 
            Code, 
            Article,
            Stock,
            CASE 
                WHEN Stock > 0 THEN 'En stock'
                ELSE 'Rupture'
            END AS status
        FROM products
    `;

    let countQuery = `SELECT COUNT(*) as totalCount FROM products`;
    
    const queryParams = [];
    const countParams = [];
    let whereClause = '';

    // Add search filter if provided
    if (search && search.trim() !== '') {
        whereClause += ' WHERE (Code LIKE ? OR Article LIKE ?)';
        const searchParam = `%${search}%`;
        queryParams.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
    }

    // Add status filter if provided
    if (status && status !== 'all') {
        const statusCondition = status === 'En stock' ? 'Stock > 0' : 'Stock <= 0';
        if (whereClause) {
            whereClause += ` AND ${statusCondition}`;
        } else {
            whereClause = ` WHERE ${statusCondition}`;
        }
    }

    // Add conditions to both queries
    query += whereClause;
    countQuery += whereClause;

    // Add sorting and pagination
    query += ' ORDER BY Article ASC LIMIT ? OFFSET ?';
    queryParams.push(itemsPerPage, offset);

    // Execute both queries in parallel
    Promise.all([
        pool.promise().query(query, queryParams),
        pool.promise().query(countQuery, countParams)
    ])
    .then(([results, countResults]) => {
        const products = results[0];
        const totalCount = countResults[0][0].totalCount;
        const totalPages = Math.ceil(totalCount / itemsPerPage);

        res.json({ 
            success: true, 
            products,
            pagination: {
                currentPage: parseInt(page),
                itemsPerPage,
                totalItems: totalCount,
                totalPages
            }
        });
    })
    .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database query failed',
            error: err.message 
        });
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


app.post('/save-invoice', upload.single('file'), async (req, res) => {
    console.log('Request received at:', new Date().toISOString());
    console.log('Request body fields:', Object.keys(req.body));
    
    let connection;
    try {
        // 1. Check if file is provided directly or needs to be generated
        let pdfBuffer;
        
        if (req.file && req.file.buffer) {
            // Use the uploaded file if available
            console.log('Using uploaded file:', req.file.size, 'bytes');
            pdfBuffer = req.file.buffer;
        } else {
            // If no file is uploaded, we'll need to generate it - but this is not implemented here
            // as it should be handled on the client side
            return res.status(400).json({ 
                success: false,
                message: 'No PDF file provided and server-side generation is not supported'
            });
        }
        
        // 2. Validate required fields
        const { store, date, type } = req.body;
        if (!store) {
            return res.status(400).json({
                success: false,
                message: 'Store information is required'
            });
        }

        // 3. Format the date properly
        const formattedDate = date 
            ? moment(date).format('YYYY-MM-DD HH:mm:ss')
            : moment().format('YYYY-MM-DD HH:mm:ss');

        // 4. Check file size before trying to save
        const maxFileSizeBytes = 10 * 1024 * 1024; // 10MB max size
        if (pdfBuffer.length > maxFileSizeBytes) {
            return res.status(400).json({
                success: false,
                message: `File too large (${Math.round(pdfBuffer.length/1024/1024)}MB). Maximum size is ${Math.round(maxFileSizeBytes/1024/1024)}MB.`
            });
        }
        
        console.log('PDF size:', Math.round(pdfBuffer.length/1024), 'KB');

        // 5. Get database connection with longer timeout for large files
        connection = await pool.promise().getConnection();
        console.log('Connected to database');
        
        // 6. Set longer query timeout for this specific query
        // REMOVED: The problematic max_allowed_packet setting
        await connection.query('SET SESSION wait_timeout = 120'); // 2 minutes timeout

        // 7. Use prepared statement to save file
        const query = `INSERT INTO invoices (store, date, type, file) VALUES (?, ?, ?, ?)`;
        const [result] = await connection.query(query, [
            store,
            formattedDate,
            type || 'Bon de livraison',
            pdfBuffer
        ]);

        console.log('Database save successful, inserted ID:', result.insertId);
        res.json({ 
            success: true,
            message: 'Invoice saved successfully',
            invoiceId: result.insertId
        });

    } catch (err) {
        console.error('Error saving invoice:', err);
        console.error('Error details:', {
            code: err.code,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage
        });
        
        // Handle specific MySQL errors with user-friendly messages
        let errorMessage = 'Database error occurred';
        
        if (err.code === 'ER_PACKET_TOO_LARGE') {
            errorMessage = 'PDF file is too large to save to the database. Please reduce the file size.';
        } else if (err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
            errorMessage = 'Database connection timed out while saving the file. Please try again.';
        } else if (err.code === 'ER_DATA_TOO_LONG') {
            errorMessage = 'File data is too long for the database field. Please reduce the file size.';
        }
        
        res.status(500).json({ 
            success: false,
            message: errorMessage,
            errorCode: err.code
        });
    } finally {
        if (connection) {
            try {
                connection.release();
                console.log('Database connection released');
            } catch (releaseErr) {
                console.error('Error releasing connection:', releaseErr);
            }
        }
    }
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


app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on port 3000');
  });
  