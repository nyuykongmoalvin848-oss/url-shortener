import express from 'express';
import dotenv from 'dotenv';
import {pool} from './db.js';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'OK', database: 'Connected' });
    }
    catch (error) {
        res.status(500).json({ status: 'Error', database: 'Not Connected' });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
export { app };