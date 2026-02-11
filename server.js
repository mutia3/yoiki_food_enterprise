const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
// Meningkatkan limit payload untuk mengantisipasi data yang besar saat aplikasi berkembang
app.use(bodyParser.json({ limit: '100mb' }));

/**
 * KONFIGURASI DATABASE TIDB CLOUD
 * Menggunakan Pool untuk stabilitas koneksi cloud yang lebih baik.
 */
const dbConfig = {
    host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    user: process.env.DB_USER || '3uGvSK2CyAaMdcF.root',
    password: process.env.DB_PASSWORD || 'jODuRPZD5gdvh4YW',
    database: process.env.DB_NAME || 'test',
    port: process.env.DB_PORT || 4000,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Cek Koneksi ke TiDB Cloud saat startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal terhubung ke TiDB Cloud:', err.message);
        console.log('Saran: Periksa koneksi internet Anda atau kredensial di file .env');
        return;
    }
    console.log('✅ Berhasil Terhubung ke TiDB Cloud (MySQL Online)!');
    
    // Inisialisasi tabel jika belum ada (Auto-migrate)
    const createTableQuery = 'CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, content LONGTEXT)';
    connection.query(createTableQuery, (qErr) => {
        if (qErr) console.error('Gagal membuat tabel:', qErr.message);
        else console.log('🛡️ Tabel app_state siap digunakan.');
        connection.release();
    });
});

/**
 * ENDPOINT API
 */

// Mengambil data dari Cloud (Load)
app.get('/api/load', (req, res) => {
    console.log('📥 Permintaan Muat Data (Load) diterima...');
    pool.query('SELECT content FROM app_state WHERE id = 1', (err, result) => {
        if (err) {
            console.error('❌ Gagal memuat data:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (result.length === 0) {
            console.log('⚠️ Database kosong, mengirimkan data default.');
            // Data default jika database masih kosong (seeding awal)
            const initialData = {
                users: [{id: 1, name: 'Bpk. Owner', username: 'owner', password: '123', role: 'owner'}],
                branches: [{id: 1, name: 'Pusat Metro', address: 'Kota Metro'}],
                stock: [], 
                opnames: [], 
                transactions: [], 
                attendance: []
            };
            return res.json(initialData);
        }
        
        console.log('✅ Data berhasil dimuat dari TiDB Cloud.');
        res.json(JSON.parse(result[0].content));
    });
});

// Menyimpan data ke Cloud (Save)
app.post('/api/save', (req, res) => {
    console.log('📤 Permintaan Simpan Data (Save) diterima...');
    const data = JSON.stringify(req.body);
    const saveQuery = 'INSERT INTO app_state (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = ?';
    
    pool.query(saveQuery, [data, data], (err) => {
        if (err) {
            console.error('❌ Gagal menyimpan data:', err.message);
            return res.status(500).send(err.message);
        }
        console.log('✅ Data berhasil disinkronisasi ke Cloud.');
        res.send({ status: 'success' });
    });
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📡 Menunggu permintaan dari Frontend YOIKI FOOD...`);
});