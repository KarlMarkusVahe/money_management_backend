const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');
const {v4: uuidv4} = require('uuid');
const bcrypt = require("bcrypt");

require('dotenv').config();

const port = process.env.PORT || 3000;

const accounts = [];
let sessions = [];

// Serve static files
app.use(express.static('public'));

// Use the Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware to parse JSON
app.use(express.json());

// General error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.statusCode || 500;
    res.status(status).send(err.message);
})

app.post('/accounts', (req, res) => {

    // Validations
    if (!req.body.email) return res.status(400).send('Email is required');
    if (!req.body.password) return res.status(400).send('Password is required');

    // Validate that the email is unique
    const existingAccount = accounts.find(a => a.email === req.body.email);
    if (existingAccount) return res.status(409).send('This email already exists in the system');


    // Hash password
    const hash = bcrypt.hashSync(req.body.password, 10);

    // Find max id, taking into account that the array might be empty
    const maxId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;

    // Create account
    let account = {
        id: maxId,
        email: req.body.email,
        password: hash
    }

    // Save account
    accounts.push(account);

    // Remove password from response without mutating the original object
    account = {...account};
    delete account.password;

    // Return account
    res.status(201).send(account);

});

app.post('/sessions', async (req, res) => {

    // Validations
    if (!req.body.email) return res.status(400).send('Email is required');
    if (!req.body.password) return res.status(400).send('Password is required');

    // Find account
    const account = accounts.find(a => a.email === req.body.email);
    console.log(account)

    // Validate account
    if (!account) return res.status(404).send('Account not found');

    // Validate password using bcrypt with promises
    bcrypt.compare(req.body.password, account.password).then(function (result) {

    });

    // Check password hash
    bcrypt.compare(req.body.password, account.password, (err, result) => {

        // Validate password
        if (!result) return res.status(401).send('Invalid password');

        // Create session
        const session = {
            id: uuidv4(),
            accountId: account.id
        }

        // Save session
        sessions.push(session);

        // Return session
        res.status(201).send(session);

    });
})

function authorizeRequest(req, res, next) {

    // Validate authorization header exists
    if (!req.headers.authorization) return res.status(401).send('Authorization header is required');

    // Validate authorization header format
    const parts = req.headers.authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).send('Authorization header format is Bearer {token}');

    // Get session token
    const token = parts[1];

    // Find session
    const session = sessions.find(s => s.id === token);
    if (!session) return res.status(401).send('Invalid token');

    // Find account
    const account = accounts.find(a => a.id === session.accountId);
    if (!account) return res.status(401).send('Invalid token');

    // Set account on request
    req.account = account;

    // Set session on request
    req.session = session;

    // Call next middleware
    next();
}

app.delete('/sessions', authorizeRequest, (req, res) => {

    // Remove session using filter
    sessions = sessions.filter(s => s.id !== req.session.id);

    // Return 204 No Content
    res.status(204).send();

})

// Array to store expenses
let expenses = [];
// Array to store income
let incomes = [];

// Route to handle expense, income creation
app.post('/expenses', (req, res) => {
    const { name, amount } = req.body;
    if (!req.body.amount) return res.status(400).send('Amount is required');
    if (!req.body.name) return res.status(400).send('Name is required');
    const expense = { name, amount };
    expenses.push(expense);
    res.status(201).json(expense);
});

app.post('/incomes', (req, res) => {
    const { name, amount } = req.body;
    if (!req.body.amount) return res.status(400).send('Amount is required');
    if (!req.body.name) return res.status(400).send('Name is required');
    const income = { name, amount };
    incomes.push(income);
    res.status(201).json(income)
});

// Route to handle expense and income retrieval
app.get('/expenses', (req, res) => {
    res.json(expenses);
});

app.get('/incomes', (req, res) => {
    res.json(incomes);
});

app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}`);
})
