// ============================================================
// 🤖 بوت تيليجرام - النسخة المتكاملة (ملف واحد)
// ============================================================
// 📌 الميزات:
//   • إرسال رسائل Fix Merah عبر البريد الإلكتروني
//   • فحص تلقائي للردود من واتساب
//   • نظام إحالات (Referral)
//   • نظام Premium
//   • نظام Owners
//   • نظام Cooldown (فردي وجماعي)
//   • دعم قواعد بيانات JSON
// ============================================================
// 👤 المطور: @zs_dm
// 📞 تواصل: @AFR_0 - @LPB_B
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const fs = require('fs');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const path = require('path');

// ============================================================
// ⚙️ الإعدادات (مدمجة من config.js)
// ============================================================

const CONFIG = {
    TELEGRAM_TOKEN: '8407230820:AAG87DEFdVKHv6CkNgWjWwgnSvUewq-6MXo',
    OWNER_ID: 8659926441,
    CHANNEL_ID: '@A_b_d_Tb',
    PROFILE_PHOTO_URL: 'https://files.catbox.moe/gsyfb0.jpg',
    EMAIL_SENDER: 'shrhhubsibsisb123@gmail.com',
    EMAIL_PASSWORD: '84kqjiqd7',
    COOLDOWN_DURATION: 300000,
    MT_FILE: 'mt_texts.json',
    PREMIUM_FILE: 'premium_users.json',
    USER_DB: 'users.json',
    HISTORY_DB: 'history.json',
    BANNED_GROUP_DB: 'banned_groups.json',
    SETTINGS_DB: 'settings.json'
};

// ============================================================
// 🚀 إنشاء البوت
// ============================================================

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: true });

// ============================================================
// 📁 دوال قاعدة البيانات
// ============================================================

const init_db_file = (filePath, defaultData) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 4), 'utf8');
    }
};

init_db_file(CONFIG.MT_FILE, []);
init_db_file(CONFIG.PREMIUM_FILE, []);
init_db_file(CONFIG.USER_DB, {});
init_db_file(CONFIG.HISTORY_DB, []);
init_db_file(CONFIG.BANNED_GROUP_DB, []);
init_db_file('groups.json', {});
init_db_file('owners.json', [CONFIG.OWNER_ID]);
init_db_file('emails.json', []);
init_db_file(CONFIG.SETTINGS_DB, {
    cooldown_duration: 60000,
    global_cooldown: 0,
    active_mt_id: 0,
    active_email_id: 0
});

let settings_cache = JSON.parse(fs.readFileSync(CONFIG.SETTINGS_DB, 'utf8'));
let cooldown_duration = settings_cache.cooldown_duration;
let active_mt_id = settings_cache.active_mt_id;
let active_email_id = settings_cache.active_email_id;

const read_db = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write_db = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');

const get_mt_texts = () => read_db(CONFIG.MT_FILE);
const get_mt_text_by_id = (id) => get_mt_texts().find(mt => mt.id === id);

const update_settings = (key, value) => {
    settings_cache[key] = value;
    write_db(CONFIG.SETTINGS_DB, settings_cache);
    if (key === 'cooldown_duration') cooldown_duration = value;
    if (key === 'active_mt_id') active_mt_id = value;
    if (key === 'active_email_id') active_email_id = value;
};

const get_owners = () => read_db('owners.json');
const is_owner = (userId) => get_owners().includes(userId);

const is_bot_admin = async (chatId) => {
    if (chatId < 0) {
        try {
            const admins = await bot.getChatAdministrators(chatId);
            const botInfo = await bot.getMe();
            const botMember = admins.find(admin => admin.user.id === botInfo.id);
            return botMember && ['administrator', 'creator'].includes(botMember.status);
        } catch (e) {
            console.error(`Gagal cek status bot di grup ${chatId}: ${e.message}`);
            try {
                const botMember = await bot.getChatMember(chatId, bot.options.id);
                return ['administrator', 'creator'].includes(botMember.status);
            } catch (e2) {
                console.error(`Gagal cek status bot di grup ${chatId}: ${e2.message}`);
                return false;
            }
        }
    }
    return true;
};

const get_group_cooldown = (chatId) => {
    const groups = read_db('groups.json');
    return groups[chatId] ? groups[chatId].cooldown : 60000;
};

const update_group_cooldown = (chatId, newCooldown) => {
    const groups = read_db('groups.json');
    groups[chatId] = { ...groups[chatId], cooldown: newCooldown };
    write_db('groups.json', groups);
};

const is_group_registered = (chatId) => {
    const groups = read_db('groups.json');
    return !!groups[chatId];
};

const get_active_email_creds = () => {
    const emails = read_db('emails.json');
    if (active_email_id === 0) {
        return { user: CONFIG.EMAIL_SENDER, pass: CONFIG.EMAIL_PASSWORD };
    }
    const active_email = emails.find(e => e.id === active_email_id);
    if (!active_email) {
        update_settings('active_email_id', 0);
        return { user: CONFIG.EMAIL_SENDER, pass: CONFIG.EMAIL_PASSWORD };
    }
    return { user: active_email.email, pass: active_email.app_pass };
};

const setup_transporter = () => {
    const creds = get_active_email_creds();
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: creds.user,
            pass: creds.pass
        },
        timeout: 30000,
        connectionTimeout: 30000,
        socketTimeout: 30000,
        tls: {
            rejectUnauthorized: false
        }
    });
};

const notify_owner = (message) => {
    get_owners().forEach(ownerId => {
        bot.sendMessage(ownerId, message, { parse_mode: 'Markdown' }).catch(e => console.error(`Gagal kirim notif ke owner ${ownerId}: ${e.message}`));
    });
};

const get_premium_users = () => read_db(CONFIG.PREMIUM_FILE);
const update_premium_users = (newUsers) => write_db(CONFIG.PREMIUM_FILE, newUsers);
const is_premium = (userId) => get_premium_users().includes(userId);

const get_user = (userId) => {
    const users = read_db(CONFIG.USER_DB);
    const defaultUser = {
        id: userId,
        username: 'N/A',
        status: is_owner(userId) ? 'owner' : (is_premium(userId) ? 'premium' : 'free'),
        is_banned: 0,
        last_fix: 0,
        fix_limit: 10,
        referral_points: 0,
        referred_by: null,
        referred_users: []
    };
    return users[userId] ? { ...defaultUser, ...users[userId] } : defaultUser;
};

const save_user = (user) => {
    const users = read_db(CONFIG.USER_DB);
    users[user.id] = user;
    write_db(CONFIG.USER_DB, users);
};

const get_all_users = () => {
    const all = read_db(CONFIG.USER_DB);
    return Object.values(all).map(u => get_user(u.id));
};

const save_history = (data) => {
    const history = read_db(CONFIG.HISTORY_DB);
    const newId = history.length > 0 ? history[history.length - 1].id + 1 : 1;
    history.push({ id: newId, ...data, timestamp: new Date().toISOString() });
    write_db(CONFIG.HISTORY_DB, history);
};

let last_checked_date = new Date(Date.now() - 3600000);

const check_email_status = (to_email) => {
    return new Promise((resolve, reject) => {
        const creds = get_active_email_creds();
        const imap = new Imap({
            user: creds.user,
            password: creds.pass,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            connTimeout: 30000,
            authTimeout: 30000,
            tlsOptions: { rejectUnauthorized: false }
        });

        const latest_email = { subject: null, body: null, date: null };

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) { imap.end(); return reject(new Error(`Gagal membuka inbox. ${err.message}`)); }

                const since = new Date();
                since.setDate(since.getDate() - 1);
                const searchCriteria = [['FROM', to_email], ['SINCE', since.toDateString()]];

                imap.search(searchCriteria, (err, results) => {
                    if (err) { imap.end(); return reject(new Error(`Gagal mencari email. ${err.message}`)); }
                    if (!results || results.length === 0) { imap.end(); return resolve(null); }

                    const latestUid = results[results.length - 1];

                    const f = imap.fetch(latestUid, { bodies: '', struct: true, envelope: true });

                    f.on('message', (msg, seqno) => {
                        msg.on('body', (stream, info) => {
                            simpleParser(stream, (err, mail) => {
                                if (err) { console.error("Mailparser error:", err); return; }
                                latest_email.subject = mail.subject;
                                latest_email.body = mail.text || mail.html;
                                latest_email.date = mail.date;
                            });
                        });
                    });

                    f.once('error', (err) => {
                        imap.end();
                        reject(new Error(`Gagal mengambil pesan. ${err.message}`));
                    });

                    f.once('end', () => {
                        imap.end();
                        resolve(latest_email);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            reject(new Error(`IMAP Connection Error: ${err.message}. Pastikan App Password benar dan Port 993 terbuka. Email Aktif: ${creds.user}`));
        });

        imap.once('end', () => {});

        imap.connect();
    });
};

// ============================================================
// 🔍 فحص تلقائي للردود
// ============================================================

const check_and_notify_users = async () => {
    const support_email = "support@support.whatsapp.com";
    const email_creds = get_active_email_creds();
    console.log(`[INSTANT CHECKER] Memulai pengecekan email dari ${support_email} di akun ${email_creds.user}...`);

    try {
        const email_data = await check_email_status(support_email);

        if (!email_data || !email_data.subject || new Date(email_data.date) <= last_checked_date) {
            console.log("[INSTANT CHECKER] Tidak ada balasan baru atau balasan sudah diproses.");
            return;
        }

        const email_body = email_data.body || "";
        const email_subject = email_data.subject || "";
        const detected_number = email_body.match(/\+\d{5,15}/) ? email_body.match(/\+\d{5,15}/)[0].replace('+', '') : null;

        if (!detected_number) {
            console.log("[INSTANT CHECKER] Balasan terbaru ditemukan, tapi tidak ada nomor WhatsApp yang terdeteksi.");
            return;
        }

        const history = read_db(CONFIG.HISTORY_DB);
        const matching_history = history
            .filter(h => h.number_fixed && h.number_fixed === detected_number)
            .pop();

        if (matching_history) {
            const user_id = matching_history.user_id;

            const response_text = `
📣 **NOTIFIKASI BALASAN WHATSAPP DITEMUKAN!**

Nomor yang Anda bandingan: **+${detected_number}**
Email yang digunakan: \`${matching_history.email_used || email_creds.user}\`

**Ringkasan Balasan:**
Subjek: \`${email_subject}\`
Tanggal: ${new Date(email_data.date).toLocaleString('id-ID')}

---
**Isi Pesan:**
\`\`\`
${email_body.substring(0, 500)}...
\`\`\`
`;
            await bot.sendMessage(user_id, response_text, { parse_mode: 'Markdown' });
            console.log(`[INSTANT CHECKER] Notifikasi berhasil dikirim ke User ID ${user_id} untuk nomor +${detected_number}.`);

            last_checked_date = new Date(email_data.date);

        } else {
            console.log(`[INSTANT CHECKER] Balasan untuk nomor +${detected_number} ditemukan, tapi tidak ada riwayat /fix yang cocok.`);
            notify_owner(`⚠️ Balasan untuk +${detected_number} DITEMUKAN di email **${email_creds.user}**, tapi tidak ada riwayat /fix yang cocok di DB.`);
        }

    } catch (e) {
        console.error(`[INSTANT CHECKER ERROR - ${email_creds.user}]`, e.message);
        if (e.message.includes("IMAP Connection Error")) {
            notify_owner(`❌ **INSTANT CHECKER GAGAL TOTAL di ${email_creds.user}:** ${e.message}`);
        }
    }
};

// ============================================================
// 📝 معالج /start
// ============================================================

const handleStart = async (msg, chatId, messageId = null) => {
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    let user = get_user(userId);

    if (chatId == userId && !user.status) {
        const parts = msg.text.split(' ');
        if (parts.length > 1 && parts[0] === '/start') {
            const referredBy = parseInt(parts[1]);
            let referrer = get_user(referredBy);

            if (referrer && referrer.id !== userId && !referrer.referred_users.includes(userId)) {
                referrer.referred_users.push(userId);
                referrer.referral_points += 1;
                save_user(referrer);

                user.referred_by = referredBy;

                bot.sendMessage(referrer.id, `🎉 **Selamat!** User @${username} baru saja bergabung melalui link referral Anda. Anda mendapatkan **1 Poin!**\n\nTotal Poin: ${referrer.referral_points}`, { parse_mode: 'Markdown' });

                notify_owner(`🌟 **REFERRAL BARU:** User @${username} dirujuk oleh Owner/User ID ${referredBy}.`);
            }
        }
    }

    user.username = username;
    user.status = is_owner(userId) ? 'owner' : (is_premium(userId) ? 'premium' : 'free');
    save_user(user);

    const referralLink = `https://t.me/${(await bot.getMe()).username}?start=${userId}`;

    const caption = `
👋 Halo ${username}!

👤 **Tentang User**
Username: @${username}
ID: \`${userId}\`
Status: **${user.status.toUpperCase()}**
Limit /fix Anda: **${user.fix_limit}x**
Poin Referral: **${user.referral_points}**

➡️ Link Referral Anda: \`${referralLink}\`

ℹ️ **Menu Bot**
Silakan pilih menu di bawah ini.
`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "👑 Semua Support", callback_data: "support" }],
            [{ text: "📝 Tutorial", callback_data: "tutorial" }],
            [{ text: "✅ Fix Merah", callback_data: "fix_merah_menu" }]
        ]
    };

    if (is_owner(userId)) {
        keyboard.inline_keyboard.push([{ text: "⚙️ Owner Menu", callback_data: "owner_menu" }]);
    }

    const editMenuCaption = async (text, markup) => {
        const params = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: markup
        };

        try {
            await bot.editMessageCaption(text, params);
        } catch (e) {
            if (e.message.includes('message caption is empty') || e.message.includes('there is no text in the message to edit')) {
                try {
                    await bot.editMessageText(text, params);
                } catch (e2) {
                    if (!e2.message.includes('message is not modified')) {
                        throw e2;
                    }
                }
            } else if (!e.message.includes('message is not modified')) {
                throw e;
            }
        }
    };

    if (messageId) {
        await editMenuCaption(caption, keyboard);
    } else {
        await bot.sendPhoto(chatId, CONFIG.PROFILE_PHOTO_URL, {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

};

bot.onText(/\/start/, (msg) => handleStart(msg, msg.chat.id));

// ============================================================
// 🛡️ فلتر الرسائل
// ============================================================

bot.on('message', (msg) => {
    const userId = msg.from.id;
    const user = get_user(userId);

    if (user.is_banned) {
        return;
    }

    if (msg.chat.type.includes('group') && !is_group_registered(msg.chat.id)) {
        if (!is_owner(userId)) {
            return;
        }
    }
});

// ============================================================
// ✅ أمر /fix
// ============================================================

bot.onText(/\/fix (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const username = msg.from.username || 'N/A';
    const raw_nomor = match[1].trim();
    const nomor = raw_nomor.replace(/[^0-9+]/g, '');
    let user = get_user(userId);

    if (msg.chat.type.includes('group')) {
        const groups = read_db('groups.json');

        if (!groups[chatId]) {
            if (is_owner(userId)) {
                bot.sendMessage(chatId, `⚠️ Grup ini belum terdaftar. Owner bisa menggunakan \`/addgroup\` agar fitur grup berfungsi penuh.`, { reply_to_message_id: msg.message_id });
            } else {
                return bot.sendMessage(chatId, `❌ Grup ini belum terdaftar. Fitur /fix hanya bisa digunakan di grup yang sudah didaftarkan Owner.`, { reply_to_message_id: msg.message_id });
            }
        } else {
            const groupCd = groups[chatId].cooldown;

            if (groups[chatId].last_fix && Date.now() < groups[chatId].last_fix + groupCd) {
                const remaining = Math.ceil((groups[chatId].last_fix + groupCd - Date.now()) / 1000);
                return bot.sendMessage(chatId, `⏳ Fitur /fix sedang dalam **cooldown grup**. Tunggu ${remaining} detik. (Cooldown grup saat ini: ${groupCd/1000} detik)`, { reply_to_message_id: msg.message_id });
            }
        }
    }

    if (!is_owner(userId)) {
        if (Date.now() < user.last_fix + cooldown_duration) {
            const remaining = Math.ceil((user.last_fix + cooldown_duration - Date.now()) / 1000);
            return bot.sendMessage(chatId, `⏳ Anda harus menunggu **cooldown individu** selama ${remaining} detik sebelum menggunakan /fix lagi. (Cooldown: ${cooldown_duration/1000} detik)`, { reply_to_message_id: msg.message_id });
        }

        if (user.fix_limit <= 0) {
            return bot.sendMessage(chatId, `❌ **Limit /fix** Anda sudah habis (${user.fix_limit}x). Undang teman untuk mendapatkan Poin Referral dan tukar Poin menjadi Limit tambahan.`, { reply_to_message_id: msg.message_id });
        }
    }

    if (nomor.length < 5) {
        return bot.sendMessage(chatId, "❌ Format nomor tidak valid. Pastikan Anda menyertakan kode negara (cth: /fix +62812xxxx).", { reply_to_message_id: msg.message_id });
    }

    const mt_texts = get_mt_texts();
    const active_template = mt_texts.find(mt => mt.id === active_mt_id);

    if (!active_template) {
        return bot.sendMessage(chatId, "❌ Tidak ada Teks Banding yang aktif. Owner harus mengaktifkan salah satunya dengan `/setactivemt <ID>`.", { reply_to_message_id: msg.message_id });
    }

    const email_creds = get_active_email_creds();
    if (!email_creds.user || !email_creds.pass) {
        return bot.sendMessage(chatId, "❌ Gagal: Tidak ada akun email aktif yang valid untuk mengirim banding. Gunakan `/setactiveemail`.", { reply_to_message_id: msg.message_id });
    }

    const body = active_template.body.replace(/{nomor}/g, nomor);

    try {
        const transporter = setup_transporter();
        await transporter.sendMail({
            from: email_creds.user,
            to: active_template.to_email,
            subject: active_template.subject,
            text: body
        });

        if (!is_owner(userId)) {
            user.fix_limit -= 1;
            user.last_fix = Date.now();
        }

        if (msg.chat.type.includes('group')) {
            const groups = read_db('groups.json');
            if (groups[chatId]) {
                groups[chatId].last_fix = Date.now();
                write_db('groups.json', groups);
            }
        }

        save_user(user);

        bot.sendMessage(chatId, `✅ Nomor ${nomor} berhasil dibandinkan dengan **MT ID ${active_mt_id}** menggunakan email **${email_creds.user}**.

*Limit Anda tersisa: ${user.fix_limit}x*
*Balasan dari WhatsApp akan otomatis dicek dan dikirim ke chat Anda!*`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });

        save_history({
            user_id: userId,
            username: username,
            command: `/fix ${nomor}`,
            group_id: msg.chat.type.includes('group') ? chatId : null,
            number_fixed: nomor.replace('+', ''),
            email_used: email_creds.user,
            details: `Berhasil mengirim banding MT ID ${active_mt_id} ke ${active_template.to_email}`
        });

        notify_owner(`⚙️ **Penggunaan Fitur /fix**

User: @${username}
ID: ${userId}
Nomor: ${nomor}
MT Aktif: ${active_mt_id}
Email: ${email_creds.user}`);

        check_and_notify_users();

    } catch (e) {
        console.error("Error saat mengirim email:", e);
        bot.sendMessage(chatId, `❌ Gagal mengirim banding untuk nomor ${nomor} menggunakan email **${email_creds.user}**:\n${e.message}`, { reply_to_message_id: msg.message_id });
        save_history({
            user_id: userId,
            username: username,
            command: `/fix ${nomor}`,
            number_fixed: nomor.replace('+', ''),
            email_used: email_creds.user,
            details: `Gagal mengirim banding: ${e.message}`
        });
    }
});

// ============================================================
// 👑 أوامر المالك (Owner)
// ============================================================

bot.onText(/\/addown (\d+)/, (msg, match) => {
    if (msg.from.id !== CONFIG.OWNER_ID) return;
    const userId = parseInt(match[1]);
    let owners = get_owners();

    if (owners.includes(userId)) {
        return bot.sendMessage(msg.chat.id, `⚠️ User ${userId} sudah terdaftar sebagai Owner.`);
    }

    owners.push(userId);
    write_db('owners.json', owners);

    let user = get_user(userId);
    user.status = 'owner';
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} berhasil ditambahkan sebagai **Owner Kedua**.`, { parse_mode: 'Markdown' });
    bot.sendMessage(userId, "👑 Anda telah diangkat menjadi **Owner** bot ini!", { parse_mode: 'Markdown' });
});

bot.onText(/\/delown (\d+)/, (msg, match) => {
    if (msg.from.id !== CONFIG.OWNER_ID) return;
    const userId = parseInt(match[1]);

    if (userId === CONFIG.OWNER_ID) {
        return bot.sendMessage(msg.chat.id, "❌ Owner utama tidak bisa dihapus.");
    }

    let owners = get_owners();
    const initial_length = owners.length;
    owners = owners.filter(id => id !== userId);

    if (owners.length === initial_length) {
        return bot.sendMessage(msg.chat.id, `❌ User ${userId} bukan Owner.`);
    }

    write_db('owners.json', owners);

    let user = get_user(userId);
    user.status = 'free';
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} berhasil dihapus dari daftar Owner.`);
    bot.sendMessage(userId, "⚠️ Akses Owner Anda telah dicabut.", { parse_mode: 'Markdown' });
});

bot.onText(/\/addgroup/, async (msg) => {
    if (!is_owner(msg.from.id)) return;
    if (!msg.chat.type.includes('group')) {
        return bot.sendMessage(msg.chat.id, "❌ Perintah ini harus dijalankan di dalam Grup.");
    }

    const chatId = msg.chat.id;
    const chatTitle = msg.chat.title;

    if (!await is_bot_admin(chatId)) {
        return bot.sendMessage(chatId, "❌ Bot harus menjadi **Administrator** di grup ini untuk didaftarkan.", { reply_to_message_id: msg.message_id });
    }

    let groups = read_db('groups.json');
    if (groups[chatId]) {
        return bot.sendMessage(chatId, `⚠️ Grup **${chatTitle}** sudah terdaftar. (Cooldown saat ini: ${groups[chatId].cooldown/1000} detik)`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
    }

    groups[chatId] = {
        title: chatTitle,
        cooldown: 60000,
        last_fix: 0
    };
    write_db('groups.json', groups);

    bot.sendMessage(chatId, `✅ Grup **${chatTitle}** berhasil didaftarkan! Cooldown grup default: 1 menit.\n\nOwner dapat mengubahnya dengan \`/setgroupcd <menit>\`.`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
});

bot.onText(/\/delgroup/, (msg) => {
    if (!is_owner(msg.from.id)) return;
    if (!msg.chat.type.includes('group')) {
        return bot.sendMessage(msg.chat.id, "❌ Perintah ini harus dijalankan di dalam Grup.");
    }

    const chatId = msg.chat.id;
    let groups = read_db('groups.json');

    if (!groups[chatId]) {
        return bot.sendMessage(chatId, "⚠️ Grup ini belum terdaftar.", { reply_to_message_id: msg.message_id });
    }

    const chatTitle = groups[chatId].title;
    delete groups[chatId];
    write_db('groups.json', groups);

    bot.sendMessage(chatId, `✅ Grup **${chatTitle}** berhasil dihapus dari daftar bot.`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
});

bot.onText(/\/setgroupcd (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    if (!msg.chat.type.includes('group')) {
        return bot.sendMessage(msg.chat.id, "❌ Perintah ini harus dijalankan di dalam Grup.");
    }

    const chatId = msg.chat.id;
    const minutes = parseInt(match[1]);

    if (!is_group_registered(chatId)) {
        return bot.sendMessage(chatId, "❌ Grup ini belum terdaftar. Gunakan `/addgroup` terlebih dahulu.", { reply_to_message_id: msg.message_id });
    }
    if (isNaN(minutes) || minutes < 1) {
        return bot.sendMessage(chatId, "⚠️ Masukkan angka menit yang valid.");
    }

    const new_cooldown = minutes * 60 * 1000;
    update_group_cooldown(chatId, new_cooldown);
    bot.sendMessage(chatId, `✅ Cooldown grup **${msg.chat.title}** berhasil diatur menjadi **${minutes} menit** (${minutes * 60} detik).`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
});

bot.onText(/\/listgroups/, (msg) => {
    if (!is_owner(msg.from.id)) return;
    const groups = read_db('groups.json');
    const groupList = Object.entries(groups).map(([id, data]) =>
        `**ID:** \`${id}\`\n**Nama:** ${data.title}\n**CD:** ${data.cooldown/60000} menit`
    ).join('\n\n');

    bot.sendMessage(msg.chat.id, `👥 **Daftar Grup Terdaftar (${Object.keys(groups).length})**\n\n${groupList || 'Tidak ada grup terdaftar.'}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/setcd (\d+)/, async (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const minutes = parseInt(match[1]);
    if (isNaN(minutes) || minutes < 1) {
        return bot.sendMessage(msg.chat.id, "⚠️ Masukkan angka menit yang valid.");
    }
    const new_cooldown = minutes * 60 * 1000;
    update_settings('cooldown_duration', new_cooldown);
    bot.sendMessage(msg.chat.id, `✅ Cooldown **individu user** berhasil diatur menjadi **${minutes} menit**.`);
});

bot.onText(/\/getlimitpoin (\d+)/, async (msg, match) => {
    if (msg.chat.id !== msg.from.id) {
        return bot.sendMessage(msg.chat.id, "❌ Perintah ini hanya bisa dijalankan di Private Chat bot.", { reply_to_message_id: msg.message_id });
    }

    const userId = msg.from.id;
    const poinToUse = parseInt(match[1]);
    let user = get_user(userId);

    if (isNaN(poinToUse) || poinToUse < 3) {
        return bot.sendMessage(msg.chat.id, "❌ Jumlah poin yang ditukar harus minimal **3 poin**.");
    }

    if (user.referral_points < poinToUse) {
        return bot.sendMessage(msg.chat.id, `❌ Poin Anda tidak mencukupi. Poin Anda saat ini: **${user.referral_points}**.`);
    }

    const limitGained = Math.floor(poinToUse / 3);
    const pointsUsed = limitGained * 3;

    user.referral_points -= pointsUsed;
    user.fix_limit += limitGained;
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ Penukaran berhasil! Anda menukar **${pointsUsed} poin** untuk mendapatkan **${limitGained} Limit /fix** tambahan.

Limit Anda saat ini: **${user.fix_limit}x**
Poin tersisa: **${user.referral_points}**`);
});

bot.onText(/\/addemail (.+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const parts = match[1].split(' ');
    if (parts.length < 2) {
        return bot.sendMessage(msg.chat.id, "❌ Format salah. Gunakan: `/addemail <email> <app_password>`");
    }

    const email = parts[0];
    const app_pass = parts.slice(1).join(' ');

    let emails = read_db('emails.json');
    const newId = emails.length > 0 ? emails[emails.length - 1].id + 1 : 1;

    if (emails.find(e => e.email === email)) {
        return bot.sendMessage(msg.chat.id, `⚠️ Email ${email} sudah terdaftar.`);
    }

    emails.push({ id: newId, email: email, app_pass: app_pass });
    write_db('emails.json', emails);
    bot.sendMessage(msg.chat.id, `✅ Email ${email} berhasil didaftarkan dengan ID **${newId}**. Gunakan \`/setactiveemail ${newId}\` untuk menggunakannya.`);
});

bot.onText(/\/listemails/, (msg) => {
    if (!is_owner(msg.from.id)) return;
    const emails = read_db('emails.json');
    const active_id = active_email_id;

    let list = `📧 **Daftar Email Terdaftar:**

`;
    list += `**ID 0 (Default Config):** ${CONFIG.EMAIL_SENDER} ${active_id === 0 ? ' [AKTIF]' : ''}
---\n`;

    emails.forEach(e => {
        list += `**ID ${e.id}:** ${e.email} ${e.id === active_id ? ' [AKTIF]' : ''}\n`;
    });

    bot.sendMessage(msg.chat.id, list, { parse_mode: 'Markdown' });
});

bot.onText(/\/setactiveemail (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const id = parseInt(match[1]);

    if (id === 0) {
        update_settings('active_email_id', 0);
        return bot.sendMessage(msg.chat.id, `✅ Email aktif berhasil disetel ke **ID 0 (Default Config)**: ${CONFIG.EMAIL_SENDER}.`);
    }

    const emails = read_db('emails.json');
    const email = emails.find(e => e.id === id);

    if (!email) {
        return bot.sendMessage(msg.chat.id, `❌ ID ${id} tidak ditemukan.`);
    }

    update_settings('active_email_id', id);
    bot.sendMessage(msg.chat.id, `✅ Email aktif berhasil disetel ke **ID ${id}**: ${email.email}.`);
});

bot.onText(/\/addpremium (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const userId = parseInt(match[1]);
    let premiumUsers = get_premium_users();

    if (premiumUsers.includes(userId)) {
        return bot.sendMessage(msg.chat.id, `⚠️ User ${userId} sudah Premium.`);
    }

    premiumUsers.push(userId);
    update_premium_users(premiumUsers);

    let user = get_user(userId);
    user.status = 'premium';
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} berhasil diangkat menjadi **Premium**.`);
    bot.sendMessage(userId, "👑 Status akun Anda telah ditingkatkan menjadi **Premium**!", { parse_mode: 'Markdown' });
});

bot.onText(/\/delprem (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const userId = parseInt(match[1]);
    let premiumUsers = get_premium_users();
    const initial_length = premiumUsers.length;
    premiumUsers = premiumUsers.filter(id => id !== userId);

    if (premiumUsers.length === initial_length) {
        return bot.sendMessage(msg.chat.id, `❌ User ${userId} bukan Premium.`);
    }

    update_premium_users(premiumUsers);

    let user = get_user(userId);
    user.status = is_owner(userId) ? 'owner' : 'free';
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} dihapus dari daftar Premium.`);
    bot.sendMessage(userId, "⚠️ Status Premium Anda telah dicabut.", { parse_mode: 'Markdown' });
});

bot.onText(/\/ban (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const userId = parseInt(match[1]);

    let user = get_user(userId);
    if (is_owner(userId)) {
        return bot.sendMessage(msg.chat.id, "❌ Tidak bisa ban Owner.");
    }

    user.is_banned = 1;
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} berhasil diban.`);
    bot.sendMessage(userId, "🚫 Akun Anda telah diblokir dan tidak dapat menggunakan bot ini.", { parse_mode: 'Markdown' });
});

bot.onText(/\/unban (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const userId = parseInt(match[1]);

    let user = get_user(userId);
    user.is_banned = 0;
    save_user(user);

    bot.sendMessage(msg.chat.id, `✅ User ${userId} berhasil diunban.`);
    bot.sendMessage(userId, "✅ Akun Anda telah diaktifkan kembali dan dapat menggunakan bot ini.", { parse_mode: 'Markdown' });
});

bot.onText(/\/owner_broadcast (.+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const message = match[1];
    const users = get_all_users().filter(u => !u.is_banned);
    let successCount = 0;

    users.forEach(user => {
        bot.sendMessage(user.id, `📢 **Pesan dari Owner:**

${message}`, { parse_mode: 'Markdown' })
            .then(() => successCount++)
            .catch(e => console.error(`Gagal kirim broadcast ke ${user.id}: ${e.message}`));
    });

    setTimeout(() => {
        bot.sendMessage(msg.chat.id, `✅ Broadcast selesai. Berhasil dikirim ke **${successCount}** user.`, { parse_mode: 'Markdown' });
    }, 5000);
});

bot.onText(/\/setactivemt (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const id = parseInt(match[1]);
    const mt_text = get_mt_text_by_id(id);

    if (!mt_text) {
        return bot.sendMessage(msg.chat.id, `❌ MT ID ${id} tidak ditemukan.`);
    }

    update_settings('active_mt_id', id);
    bot.sendMessage(msg.chat.id, `✅ Teks Banding Aktif disetel ke **ID ${id}** (Subjek: ${mt_text.subject})`);
});

bot.onText(/\/offmt/, (msg) => {
    if (!is_owner(msg.from.id)) return;
    update_settings('active_mt_id', 0);
    bot.sendMessage(msg.chat.id, `❌ Teks Banding berhasil **dinonaktifkan**.`);
});

bot.onText(/\/getuser (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const userId = parseInt(match[1]);
    const user = get_user(userId);

    const info = `
👤 **Detail User ID ${userId}**
Username: @${user.username}
Status: **${user.status.toUpperCase()}**
Banned: ${user.is_banned ? 'YA' : 'TIDAK'}
Limit /fix: **${user.fix_limit}x**
Poin Referral: **${user.referral_points}**
Terakhir /fix: ${user.last_fix ? new Date(user.last_fix).toLocaleString('id-ID') : 'Belum pernah'}
Referred By: ${user.referred_by || 'N/A'}
`;

    bot.sendMessage(msg.chat.id, info, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, (msg) => {
    if (!is_owner(msg.from.id)) return;
    const users = get_all_users();
    const totalUsers = users.length;
    const premiumCount = users.filter(u => u.status === 'premium').length;
    const ownerCount = users.filter(u => u.status === 'owner').length;
    const bannedCount = users.filter(u => u.is_banned).length;

    const stats = `
📊 **Statistik Bot**
Total User: **${totalUsers}**
Owner (Total): **${ownerCount}**
Premium: **${premiumCount}**
Banned: **${bannedCount}**
`;
    bot.sendMessage(msg.chat.id, stats, { parse_mode: 'Markdown' });
});

bot.onText(/\/setmt (.+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const parts = match[1].split('|').map(p => p.trim());

    if (parts.length < 3) {
        return bot.sendMessage(msg.chat.id, "❌ Format salah. Gunakan: `/setmt <email_tujuan> | <subjek> | <isi pesan>`");
    }

    const [to_email, subject, body] = parts;

    if (!body.includes('{nomor}')) {
        return bot.sendMessage(msg.chat.id, "❌ Isi pesan wajib mengandung `{nomor}` untuk placeholder nomor WhatsApp.");
    }

    let mt_texts = get_mt_texts();
    const newId = mt_texts.length > 0 ? mt_texts[mt_texts.length - 1].id + 1 : 1;

    mt_texts.push({ id: newId, to_email, subject, body });
    write_db(CONFIG.MT_FILE, mt_texts);

    bot.sendMessage(msg.chat.id, `✅ MT ID **${newId}** berhasil ditambahkan.
Subjek: ${subject}
Email Tujuan: ${to_email}`);
});

bot.onText(/\/delmt (\d+)/, (msg, match) => {
    if (!is_owner(msg.from.id)) return;
    const id = parseInt(match[1]);
    let mt_texts = get_mt_texts();
    const initial_length = mt_texts.length;
    const mt_to_delete = mt_texts.find(mt => mt.id === id);

    if (!mt_to_delete) {
        return bot.sendMessage(msg.chat.id, `❌ MT ID ${id} tidak ditemukan.`);
    }

    if (id === active_mt_id) {
        update_settings('active_mt_id', 0);
        bot.sendMessage(msg.chat.id, `⚠️ MT ID ${id} yang aktif telah dinonaktifkan.`);
    }

    mt_texts = mt_texts.filter(mt => mt.id !== id);
    write_db(CONFIG.MT_FILE, mt_texts);

    bot.sendMessage(msg.chat.id, `✅ MT ID **${id}** (${mt_to_delete.subject}) berhasil dihapus.`);
});

// ============================================================
// 🎯 معالج الأزرار (Callback Query)
// ============================================================

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (!is_owner(callbackQuery.from.id) && data.startsWith('owner_')) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Anda bukan owner.", show_alert: true });
    }

    const editMenuCaption = async (text, markup) => {
        const params = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: markup
        };

        try {
            await bot.editMessageCaption(text, params);
        } catch (e) {
            if (e.message.includes('message caption is empty') || e.message.includes('there is no text in the message to edit')) {
                try {
                    await bot.editMessageText(text, params);
                } catch (e2) {
                    if (!e2.message.includes('message is not modified')) {
                        throw e2;
                    }
                }
            } else if (!e.message.includes('message is not modified')) {
                throw e;
            }
        }
    };

    try {
        switch (data) {
            case 'support':
                await editMenuCaption("💖 Semua support terbaik saya adalah: Allah SWT, Ayah, Ibu, dan semua user setia bot ini.",
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "start" }]] });
                break;
            case 'tutorial':
                await editMenuCaption("📝 **Tutorial Banding Email**

Gunakan fitur `/fix <nomor>` (cth: `/fix +62812xxxx`). Balasan dari WhatsApp akan otomatis dicek dan dikirim ke chat ini.",
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "start" }]] });
                break;
            case 'fix_merah_menu':
                const user = get_user(callbackQuery.from.id);
                const cd_indv = cooldown_duration / 60000;
                await editMenuCaption(`⚙️ **Fitur Fix Merah**

Limit Anda: **${user.fix_limit}x**
Cooldown Individu: **${cd_indv} menit**.

Gunakan perintah \`/fix <nomor>\` (cth: \`/fix +62812xxxx\`) untuk mengirim banding otomatis.`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "start" }]] });
                break;
            case 'owner_menu':
                const current_active_mt = active_mt_id > 0 ? `ID **${active_mt_id}**` : '❌ NON-AKTIF';
                const owner_keyboard = {
                    inline_keyboard: [
                        [{ text: "Status Email Aktif", callback_data: "owner_email_status" }],
                        [{ text: "Kelola Email (Multi)", callback_data: "owner_email_menu" }],
                        [{ text: "Kelola MT Text", callback_data: "owner_mt_menu" }],
                        [{ text: "Kelola Grup & CD Grup", callback_data: "owner_group_menu" }],
                        [{ text: "Kelola Owner", callback_data: "owner_owner_menu" }],
                        [{ text: "List All User", callback_data: "owner_list_user" }],
                        [{ text: "History Fix", callback_data: "owner_history_fix" }],
                        [{ text: "Broadcast All User", callback_data: "owner_broadcast_menu" }],
                        [{ text: "Kelola Premium & Akses", callback_data: "owner_access_menu" }],
                        [{ text: "Set CD Individu", callback_data: "owner_setcd_menu" }],
                        [{ text: "↩️ Kembali", callback_data: "start" }]
                    ]
                };
                await editMenuCaption(`⚙️ **Owner Menu**

MT Aktif Saat Ini: ${current_active_mt}`, owner_keyboard);
                break;

            case 'owner_email_status':
                const creds_status = get_active_email_creds();
                let active_id_text;
                if (active_email_id === 0) {
                    active_id_text = `ID 0 (Default Config)`;
                } else {
                    const emails = read_db('emails.json');
                    const active_email_obj = emails.find(e => e.id === active_email_id);
                    if (active_email_obj) {
                        active_id_text = `ID ${active_email_id}`;
                    } else {
                        update_settings('active_email_id', 0);
                        active_id_text = `ID 0 (Default Config). ID lama ${active_email_id} tidak ditemukan dan direset.`;
                    }
                }
                await editMenuCaption(`📧 **Status Email Aktif**

Email Aktif: \`${creds_status.user}\`
ID Aktif: **${active_id_text}**`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_group_menu':
                await editMenuCaption(`👥 **Kelola Grup & Cooldown Grup**

\\* Bot hanya akan merespon /fix di grup yang sudah terdaftar.

**Perintah Grup:**
- \`/addgroup\` (di dalam grup)
- \`/delgroup\` (di dalam grup)
- \`/setgroupcd <menit>\` (di dalam grup)
- \`/listgroups\``,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_owner_menu':
                const owners = get_owners();
                const ownerList = owners.map(id => is_owner(id) && id === CONFIG.OWNER_ID ? `👑 ID ${id} (Utama)` : `👤 ID ${id}`).join('\n');
                await editMenuCaption(`👑 **Kelola Owner Bot**

Owner saat ini:
${ownerList}

**Perintah Owner:**
- \`/addown <id_user>\`
- \`/delown <id_user>\``,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_email_menu':
                const email_menu_keyboard = {
                    inline_keyboard: [
                        [{ text: "List/Set Active Email", callback_data: "owner_list_email_menu" }],
                        [{ text: "Tambah Email Baru", callback_data: "owner_add_email_menu" }],
                        [{ text: "↩️ Kembali", callback_data: "owner_menu" }]
                    ]
                };
                await editMenuCaption("📧 **Kelola Email Multi-Akun**", email_menu_keyboard);
                break;

            case 'owner_list_email_menu':
                await editMenuCaption(`📧 **List/Set Active Email**

Lihat semua email terdaftar: \`/listemails\`
Atur email aktif: \`/setactiveemail <id>\`

*ID 0 adalah email dari config.js.*`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_email_menu" }]] });
                break;

            case 'owner_add_email_menu':
                await editMenuCaption(`📧 **Tambah Email Baru**

Gunakan format: \`/addemail <email> <app_password>\`

*Wajib menggunakan App Password Gmail. Pastikan IMAP aktif!*`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_email_menu" }]] });
                break;

            case 'owner_list_user':
                const users = get_all_users();
                const userText = users.map(r => `**ID:** ${r.id}, **@${r.username}**, Status: ${r.status}, Limit: ${r.fix_limit}x, Poin: ${r.referral_points}`).join('\n');
                await editMenuCaption(`👤 **List Semua User**

${userText}`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_history_fix':
                const history = read_db(CONFIG.HISTORY_DB).filter(r => r.command.startsWith('/fix')).slice(-20).reverse();
                const historyText = history.map(r => `[${r.timestamp.split('T')[0]}] **@${r.username}** menggunakan ${r.command}`).join('\n');
                await editMenuCaption(`📜 **Riwayat Fix Terbaru**

${historyText || 'Tidak ada riwayat.'}`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_broadcast_menu':
                await editMenuCaption("📢 **Broadcast**

Gunakan perintah: `/owner_broadcast <pesan>`",
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_mt_menu':
                const mt_keyboard = {
                    inline_keyboard: [
                        [{ text: "Lihat MT", callback_data: "owner_view_mt" }],
                        [{ text: "Aktifkan/Nonaktifkan MT", callback_data: "owner_set_active_menu" }],
                        [{ text: "Tambah MT", callback_data: "owner_add_mt_menu" }],
                        [{ text: "Hapus MT", callback_data: "owner_del_mt_menu" }],
                        [{ text: "↩️ Kembali", callback_data: "owner_menu" }]
                    ]
                };
                await editMenuCaption("📝 **Kelola MT Text**", mt_keyboard);
                break;

            case 'owner_set_active_menu':
                const current_active_status = active_mt_id > 0 ? `MT ID **${active_mt_id}** (Aktif)` : `Tidak ada (Non-Aktif)`;
                await editMenuCaption(`▶️ **Aktifkan/Nonaktifkan Teks Banding**

Status: ${current_active_status}

➡️ **AKTIFKAN:** Gunakan perintah \`/setactivemt <id_mt>\`
➡️ **NONAKTIFKAN:** Gunakan perintah \`/offmt\``,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_mt_menu" }]] });
                break;

            case 'owner_view_mt':
                const mt_texts_view = get_mt_texts();
                const viewText = mt_texts_view.map(mt => `**ID:** ${mt.id}
**Subjek:** ${mt.subject}
**Email Tujuan:** ${mt.to_email}
**Body Snippet:** ${mt.body.substring(0, 50).replace(/\n/g, ' ')}...`).join('\n\n');
                await editMenuCaption(`📝 **Daftar MT**

${viewText || 'Tidak ada MT yang tersedia.'}`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_mt_menu" }]] });
                break;

            case 'owner_add_mt_menu':
                await editMenuCaption("📝 **Tambah Teks Banding**

Gunakan format: `/setmt <email_tujuan> | <subjek> | <isi pesan>`

*Wajib sertakan \`{nomor}\` di isi pesan!*`,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_mt_menu" }]] });
                break;

            case 'owner_del_mt_menu':
                await editMenuCaption("📝 **Hapus Teks Banding**

Gunakan format: `/delmt <id_mt>`",
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_mt_menu" }]] });
                break;

            case 'owner_access_menu':
                await editMenuCaption("👮 **Kelola Akses & Premium**

**Perintah Akses:**
- `/addpremium <id_user>`
- `/delprem <id_user>`
- `/ban <id_user>`
- `/unban <id_user>`",
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'owner_setcd_menu':
                const cd_current = cooldown_duration / 60000;
                await editMenuCaption(`⏳ **Atur Cooldown Individu**

Cooldown individu saat ini: **${cd_current} menit**.

Gunakan perintah: \`/setcd <menit>\``,
                    { inline_keyboard: [[{ text: "↩️ Kembali", callback_data: "owner_menu" }]] });
                break;

            case 'start':
                handleStart(callbackQuery.message, chatId, messageId);
                break;
        }
    } catch (e) {
        if (e.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        console.error("Error di callback query:", e);

        return bot.answerCallbackQuery(callbackQuery.id, { text: `❌ Gagal memuat menu. Coba lagi dari /start. (${e.message.split(':').pop().trim()})`, show_alert: true });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
});

// ============================================================
// 🔄 فحص تلقائي كل 30 ثانية
// ============================================================

console.log("🚀 Bot berjalan di Termux (Database File JSON)...");

setInterval(check_and_notify_users, 30000);