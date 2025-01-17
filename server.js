import express from 'express';
import allRoutes from './routes/index';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(allRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
