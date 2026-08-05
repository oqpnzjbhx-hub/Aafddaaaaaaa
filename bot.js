// ============================================================
// 🤖 بوت تيليجرام - النسخة النهائية الصحيحة
// ============================================================
// 👤 المطور: @zs_dm
// 📞 تواصل: @AFR_0 - @LPB_B
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const fs = require('fs');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

// ============================================================
// ⚙️ الإعدادات (مدمجة)
// ============================================================

const CONFIG = {
    TELEGRAM_TOKEN: '8407230820:AAG87DEFdVKHv6CkNgWjWwgnSvUewq-6MXo',
    OWNER_ID: 8659926441,
    PROFILE_PHOTO_URL: 'https://files.catbox.moe/gsyfb0.jpg',
    EMAIL_SENDER: 'shrhhubsibsisb123@gmail.com',
    EMAIL_PASSWORD: '84kqjiqd7',
    COOLDOWN_DURATION: 300000,
    MT_FILE: 'mt_texts.json',
    PREMIUM_FILE: 'premium_users.json',
    USER_DB: 'users.json',
    HISTORY_DB: 'history.json',
    SETTINGS_DB: 'settings.json'
};

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: true });

// ============================================================
// 📁 دوال قاعدة البيانات
// ============================================================

const init_db = (file, defaultData) => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 4));
    }
};

init_db(CONFIG.MT_FILE, []);
init_db(CONFIG.PREMIUM_FILE, []);
init_db(CONFIG.USER_DB, {});
init_db(CONFIG.HISTORY_DB, []);
init_db('owners.json', [CONFIG.OWNER_ID]);
init_db('emails.json', []);
init_db(CONFIG.SETTINGS_DB, {
    cooldown_duration: 60000,
    active_mt_id: 0,
    active_email_id: 0
});

const readDB = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeDB = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');

let settings = readDB(CONFIG.SETTINGS_DB);
let cooldown_duration = settings.cooldown_duration;
let active_mt_id = settings.active_mt_id;
let active_email_id = settings.active_email_id;

const get_mt_texts = () => readDB(CONFIG.MT_FILE);
const get_mt_by_id = (id) => get_mt_texts().find(mt => mt.id === id);

const updateSettings = (key, value) => {
    settings[key] = value;
    writeDB(CONFIG.SETTINGS_DB, settings);
    if (key === 'cooldown_duration') cooldown_duration = value;
    if (key === 'active_mt_id') active_mt_id = value;
    if (key === 'active_email_id') active_email_id = value;
};

const isOwner = (userId) => {
    const owners = readDB('owners.json');
    return owners.includes(userId);
};

const get_active_email = () => {
    const emails = readDB('emails.json');
    if (active_email_id === 0) {
        return { user: CONFIG.EMAIL_SENDER, pass: CONFIG.EMAIL_PASSWORD };
    }
    const active = emails.find(e => e.id === active_email_id);
    if (!active) {
        updateSettings('active_email_id', 0);
        return { user: CONFIG.EMAIL_SENDER, pass: CONFIG.EMAIL_PASSWORD };
    }
    return { user: active.email, pass: active.app_pass };
};

const get_user = (userId) => {
    const users = readDB(CONFIG.USER_DB);
    const defaultUser = {
        id: userId,
        username: 'N/A',
        status: isOwner(userId) ? 'owner' : 'free',
        is_banned: 0,
        last_fix: 0,
        fix_limit: 10,
        referral_points: 0
    };
    return users[userId] ? { ...defaultUser, ...users[userId] } : defaultUser;
};

const save_user = (user) => {
    const users = readDB(CONFIG.USER_DB);
    users[user.id] = user;
    writeDB(CONFIG.USER_DB, users);
};

const get_all_users = () => {
    const all = readDB(CONFIG.USER_DB);
    return Object.values(all).map(u => get_user(u.id));
};

const save_history = (data) => {
    const history = readDB(CONFIG.HISTORY_DB);
    const newId = history.length > 0 ? history[history.length - 1].id + 1 : 1;
    history.push({ id: newId, ...data, timestamp: new Date().toISOString() });
    writeDB(CONFIG.HISTORY_DB, history);
};

const notify_owner = (msg) => {
    readDB('owners.json').forEach(ownerId => {
        bot.sendMessage(ownerId, msg, { parse_mode: 'Markdown' }).catch(() => {});
    });
};

// ============================================================
// 📧 إعداد البريد
// ============================================================

const getTransporter = () => {
    const creds = get_active_email();
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: creds.user, pass: creds.pass },
        timeout: 30000,
        tls: { rejectUnauthorized: false }
    });
};

// ============================================================
// 📧 فحص البريد الوارد
// ============================================================

let lastChecked = new Date(Date.now() - 3600000);

const checkEmail = (fromEmail) => {
    return new Promise((resolve, reject) => {
        const creds = get_active_email();
        const imap = new Imap({
            user: creds.user,
            password: creds.pass,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            connTimeout: 30000,
            tlsOptions: { rejectUnauthorized: false }
        });

        const result = { subject: null, body: null, date: null };

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err) => {
                if (err) {
                    imap.end();
                    return reject(new Error('Gagal membuka inbox: ' + err.message));
                }

                const since = new Date();
                since.setDate(since.getDate() - 1);
                imap.search([['FROM', fromEmail], ['SINCE', since.toDateString()]], (err, results) => {
                    if (err || !results || results.length === 0) {
                        imap.end();
                        return resolve(null);
                    }

                    const latest = results[results.length - 1];
                    const f = imap.fetch(latest, { bodies: '', struct: true, envelope: true });

                    f.on('message', (msg) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, (err, mail) => {
                                if (err) return;
                                result.subject = mail.subject;
                                result.body = mail.text || mail.html;
                                result.date = mail.date;
                            });
                        });
                    });

                    f.once('end', () => {
                        imap.end();
                        resolve(result);
                    });

                    f.once('error', (err) => {
                        imap.end();
                        reject(new Error('Gagal mengambil pesan: ' + err.message));
                    });
                });
            });
        });

        imap.once('error', (err) => {
            reject(new Error('IMAP Error: ' + err.message));
        });

        imap.connect();
    });
};

// ============================================================
// 🔍 فحص تلقائي
// ============================================================

const autoCheck = async () => {
    const fromEmail = 'support@support.whatsapp.com';
    try {
        const email = await checkEmail(fromEmail);
        if (!email || !email.subject || new Date(email.date) <= lastChecked) return;

        const body = email.body || '';
        const match = body.match(/\+?\d{5,15}/);
        const number = match ? match[0].replace('+', '') : null;
        if (!number) return;

        const history = readDB(CONFIG.HISTORY_DB);
        const entry = history.filter(h => h.number_fixed === number).pop();
        if (!entry) return;

        const msg = 
'📣 **BALASAN DITEMUKAN!**\n\n' +
'Nomor: **+' + number + '**\n\n' +
'**Subjek:** ' + email.subject + '\n' +
'**Tanggal:** ' + new Date(email.date).toLocaleString('id-ID') + '\n\n' +
'```\n' + body.substring(0, 500) + '...\n```';

        await bot.sendMessage(entry.user_id, msg, { parse_mode: 'Markdown' });
        lastChecked = new Date(email.date);
        console.log('✅ Notifikasi terkirim untuk +' + number);
    } catch (e) {
        console.error('AutoCheck error:', e.message);
    }
};

// ============================================================
// 📝 أمر /start
// ============================================================

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    let user = get_user(userId);

    if (msg.text && msg.text.includes(' ')) {
        const ref = parseInt(msg.text.split(' ')[1]);
        if (ref && ref !== userId) {
            const referrer = get_user(ref);
            if (!referrer.referred_users || !referrer.referred_users.includes(userId)) {
                referrer.referral_points = (referrer.referral_points || 0) + 1;
                if (!referrer.referred_users) referrer.referred_users = [];
                referrer.referred_users.push(userId);
                save_user(referrer);
                user.referred_by = ref;
                bot.sendMessage(ref, '🎉 Referral baru! +1 Poin. Total: ' + referrer.referral_points);
            }
        }
    }

    user.username = username;
    user.status = isOwner(userId) ? 'owner' : 'free';
    save_user(user);

    const botInfo = await bot.getMe();
    const link = 'https://t.me/' + botInfo.username + '?start=' + userId;

    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ Fix Merah', callback_data: 'fix_menu' }],
            [{ text: '📝 Tutorial', callback_data: 'tutorial' }]
        ]
    };

    if (isOwner(userId)) {
        keyboard.inline_keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]);
    }

    const caption = 
'👋 Halo ' + username + '!\n\n' +
'ID: `' + userId + '`\n' +
'Status: **' + user.status.toUpperCase() + '**\n' +
'Limit: **' + user.fix_limit + 'x**\n' +
'Poin: **' + user.referral_points + '**\n\n' +
'🔗 Link Referral: `' + link + '`';

    await bot.sendPhoto(userId, CONFIG.PROFILE_PHOTO_URL, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// ============================================================
// ✅ أمر /fix
// ============================================================

bot.onText(/\/fix (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const username = msg.from.username || 'N/A';
    const raw = match[1].trim();
    const number = raw.replace(/[^0-9+]/g, '');
    let user = get_user(userId);

    if (number.length < 5) {
        return bot.sendMessage(chatId, '❌ Format salah. Contoh: /fix +62812xxxx');
    }

    const mtList = get_mt_texts();
    const activeMt = mtList.find(mt => mt.id === active_mt_id);
    if (!activeMt) {
        return bot.sendMessage(chatId, '❌ Tidak ada MT aktif. Admin harus mengaktifkan salah satu.');
    }

    const emailCreds = get_active_email();
    if (!emailCreds.user || !emailCreds.pass) {
        return bot.sendMessage(chatId, '❌ Tidak ada email aktif.');
    }

    const body = activeMt.body.replace(/{nomor}/g, number);

    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from: emailCreds.user,
            to: activeMt.to_email,
            subject: activeMt.subject,
            text: body
        });

        if (!isOwner(userId)) {
            user.fix_limit -= 1;
            user.last_fix = Date.now();
        }
        save_user(user);

        bot.sendMessage(chatId, '✅ Nomor ' + number + ' berhasil dikirim.\n📧 ' + emailCreds.user + '\n✅ Limit: ' + user.fix_limit + 'x');

        save_history({
            user_id: userId,
            username: username,
            command: '/fix ' + number,
            number_fixed: number.replace('+', ''),
            email_used: emailCreds.user
        });

        autoCheck();
    } catch (e) {
        bot.sendMessage(chatId, '❌ Gagal: ' + e.message);
    }
});

// ============================================================
// 🎯 معالج الأزرار (Callback)
// ============================================================

bot.on('callback_query', async (call) => {
    const chatId = call.message.chat.id;
    const msgId = call.message.message_id;
    const data = call.data;

    const edit = async (text, keyboard) => {
        try {
            await bot.editMessageCaption(text, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (e) {
            if (!e.message.includes('not modified')) {
                console.log('Edit error:', e.message);
            }
        }
    };

    try {
        // ===== القائمة الرئيسية =====
        if (data === 'fix_menu') {
            const user = get_user(call.from.id);
            await edit('✅ **Fix Merah**\n\nLimit: **' + user.fix_limit + 'x**\nCooldown: **' + (cooldown_duration/60000) + ' menit**\n\nGunakan `/fix +62812xxxx`', 
                { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'back' }]] });
            return;
        }

        if (data === 'tutorial') {
            await edit('📝 **Tutorial**\n\nGunakan `/fix +62812xxxx`\nBalasan akan otomatis masuk.', 
                { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'back' }]] });
            return;
        }

        if (data === 'back') {
            const user = get_user(call.from.id);
            const botInfo = await bot.getMe();
            const link = 'https://t.me/' + botInfo.username + '?start=' + call.from.id;
            const keyboard = {
                inline_keyboard: [
                    [{ text: '✅ Fix Merah', callback_data: 'fix_menu' }],
                    [{ text: '📝 Tutorial', callback_data: 'tutorial' }]
                ]
            };
            if (isOwner(call.from.id)) {
                keyboard.inline_keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]);
            }
            await edit('👋 Halo ' + user.username + '!\n\nID: `' + call.from.id + '`\nStatus: **' + user.status.toUpperCase() + '**\nLimit: **' + user.fix_limit + 'x**\nLink: `' + link + '`', keyboard);
            return;
        }

        // ===== Admin Panel =====
        if (data === 'admin_panel') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 Kelola Email', callback_data: 'admin_email' }],
                    [{ text: '📝 Kelola MT', callback_data: 'admin_mt' }],
                    [{ text: '👥 Kelola User', callback_data: 'admin_user' }],
                    [{ text: '📊 Statistik', callback_data: 'admin_stats' }],
                    [{ text: '↩️ Kembali', callback_data: 'back' }]
                ]
            };
            await edit('👑 **Admin Panel**\n\nPilih menu:', keyboard);
            return;
        }

        // ===== إدارة البريد =====
        if (data === 'admin_email') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 Tambah Email', callback_data: 'admin_add_email' }],
                    [{ text: '📋 Daftar Email', callback_data: 'admin_list_email' }],
                    [{ text: '🔄 Set Active', callback_data: 'admin_set_email' }],
                    [{ text: '↩️ Kembali', callback_data: 'admin_panel' }]
                ]
            };
            await edit('📧 **Kelola Email**', keyboard);
            return;
        }

        if (data === 'admin_add_email') {
            await bot.sendMessage(chatId, '📧 Kirim: `email|app_password`');
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ Format: email|password');
                }
                const [email, pass] = m.text.split('|').map(s => s.trim());
                const emails = readDB('emails.json');
                const newId = emails.length > 0 ? emails[emails.length - 1].id + 1 : 1;
                emails.push({ id: newId, email, app_pass: pass });
                writeDB('emails.json', emails);
                bot.sendMessage(chatId, '✅ Email **' + email + '** ditambahkan (ID: ' + newId + ')');
            });
            return;
        }

        if (data === 'admin_list_email') {
            const emails = readDB('emails.json');
            let txt = '📋 **Daftar Email**\n\n';
            txt += 'ID 0: ' + CONFIG.EMAIL_SENDER + (active_email_id === 0 ? ' ✅' : '') + '\n';
            emails.forEach(e => {
                txt += 'ID ' + e.id + ': ' + e.email + (e.id === active_email_id ? ' ✅' : '') + '\n';
            });
            await edit(txt, { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'admin_email' }]] });
            return;
        }

        if (data === 'admin_set_email') {
            await bot.sendMessage(chatId, '📧 Kirim ID email (contoh: `1` atau `0` untuk default)');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ ID harus angka');
                if (id === 0) {
                    updateSettings('active_email_id', 0);
                    return bot.sendMessage(chatId, '✅ Email default aktif');
                }
                const emails = readDB('emails.json');
                const found = emails.find(e => e.id === id);
                if (!found) return bot.sendMessage(chatId, '❌ ID tidak ditemukan');
                updateSettings('active_email_id', id);
                bot.sendMessage(chatId, '✅ Email **' + found.email + '** aktif');
            });
            return;
        }

        // ===== إدارة MT =====
        if (data === 'admin_mt') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📝 Tambah MT', callback_data: 'admin_add_mt' }],
                    [{ text: '📋 Daftar MT', callback_data: 'admin_list_mt' }],
                    [{ text: '🔄 Set Active', callback_data: 'admin_set_mt' }],
                    [{ text: '↩️ Kembali', callback_data: 'admin_panel' }]
                ]
            };
            await edit('📝 **Kelola MT**', keyboard);
            return;
        }

        if (data === 'admin_add_mt') {
            await bot.sendMessage(chatId, '📝 Kirim: `email_tujuan|subjek|isi_pesan`\n*Sertakan {nomor}*');
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ Format: email|subjek|isi');
                }
                const [to, subject, body] = m.text.split('|').map(s => s.trim());
                if (!body.includes('{nomor}')) {
                    return bot.sendMessage(chatId, '❌ Wajib sertakan {nomor}');
                }
                const list = get_mt_texts();
                const newId = list.length > 0 ? list[list.length - 1].id + 1 : 1;
                list.push({ id: newId, to_email: to, subject, body });
                writeDB(CONFIG.MT_FILE, list);
                bot.sendMessage(chatId, '✅ MT ID **' + newId + '** ditambahkan');
            });
            return;
        }

        if (data === 'admin_list_mt') {
            const list = get_mt_texts();
            let txt = '📋 **Daftar MT**\n\n';
            list.forEach(mt => {
                txt += 'ID ' + mt.id + ': ' + mt.subject + ' → ' + mt.to_email + '\n';
            });
            if (!list.length) txt += 'Belum ada MT';
            await edit(txt, { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'admin_mt' }]] });
            return;
        }

        if (data === 'admin_set_mt') {
            await bot.sendMessage(chatId, '📝 Kirim ID MT (contoh: `1` atau `0` untuk nonaktif)');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ ID harus angka');
                if (id === 0) {
                    updateSettings('active_mt_id', 0);
                    return bot.sendMessage(chatId, '❌ MT dinonaktifkan');
                }
                const found = get_mt_by_id(id);
                if (!found) return bot.sendMessage(chatId, '❌ ID tidak ditemukan');
                updateSettings('active_mt_id', id);
                bot.sendMessage(chatId, '✅ MT ID **' + id + '** aktif');
            });
            return;
        }

        // ===== إدارة المستخدمين =====
        if (data === 'admin_user') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 Daftar User', callback_data: 'admin_list_users' }],
                    [{ text: '🚫 Ban', callback_data: 'admin_ban' }],
                    [{ text: '🟢 Unban', callback_data: 'admin_unban' }],
                    [{ text: '↩️ Kembali', callback_data: 'admin_panel' }]
                ]
            };
            await edit('👥 **Kelola User**', keyboard);
            return;
        }

        if (data === 'admin_list_users') {
            const users = get_all_users();
            let txt = '📋 **Daftar User**\n\n';
            users.slice(0, 20).forEach(u => {
                txt += 'ID: ' + u.id + ' | @' + u.username + ' | ' + u.status + ' | Limit: ' + u.fix_limit + 'x\n';
            });
            await edit(txt, { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'admin_user' }]] });
            return;
        }

        if (data === 'admin_ban') {
            await bot.sendMessage(chatId, '🚫 Kirim ID user untuk di-ban');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ ID harus angka');
                if (isOwner(id)) return bot.sendMessage(chatId, '❌ Tidak bisa ban Owner');
                const user = get_user(id);
                user.is_banned = 1;
                save_user(user);
                bot.sendMessage(chatId, '✅ User **' + id + '** di-ban');
            });
            return;
        }

        if (data === 'admin_unban') {
            await bot.sendMessage(chatId, '🟢 Kirim ID user untuk di-unban');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ ID harus angka');
                const user = get_user(id);
                user.is_banned = 0;
                save_user(user);
                bot.sendMessage(chatId, '✅ User **' + id + '** di-unban');
            });
            return;
        }

        // ===== الإحصائيات =====
        if (data === 'admin_stats') {
            const users = get_all_users();
            const total = users.length;
            const banned = users.filter(u => u.is_banned).length;
            const owners = users.filter(u => u.status === 'owner').length;
            const mtCount = get_mt_texts().length;
            const emailCount = readDB('emails.json').length;

            const txt = 
'📊 **Statistik**\n\n' +
'👥 Total User: **' + total + '**\n' +
'👑 Owner: **' + owners + '**\n' +
'🚫 Banned: **' + banned + '**\n' +
'📝 MT: **' + mtCount + '**\n' +
'📧 Email: **' + emailCount + '**\n' +
'⏱️ Cooldown: **' + (cooldown_duration/60000) + ' menit**';

            await edit(txt, { inline_keyboard: [[{ text: '↩️ Kembali', callback_data: 'admin_panel' }]] });
            return;
        }

        console.log('Unknown callback:', data);

    } catch (e) {
        console.error('Callback error:', e.message);
        bot.answerCallbackQuery(call.id, { text: '❌ Error: ' + e.message, show_alert: true });
    }

    bot.answerCallbackQuery(call.id);
});

// ============================================================
// 🚀 التشغيل
// ============================================================

console.log('🚀 Bot berjalan di Render...');

setInterval(autoCheck, 30000);