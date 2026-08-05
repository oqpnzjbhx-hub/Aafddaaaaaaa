// ============================================================
// 🤖 محارب الابتزاز - النسخة النهائية المُصلحة
// ============================================================
// 👤 المطور: @A_b_d_Tb
// 📞 الدعم: @A_b_d_Tb
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const fs = require('fs');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

// ============================================================
// ⚙️ الإعدادات
// ============================================================

const CONFIG = {
    TELEGRAM_TOKEN: '8884594440:AAEFSNSoNNRhkaZuux0VhuzhZT2U5MSOjwQ',
    OWNER_ID: 8659926441,
    PROFILE_PHOTO_URL: 'https://files.catbox.moe/gsyfb0.jpg',
    EMAIL_SENDER: 'shrhhubsibsisb123@gmail.com',
    EMAIL_PASSWORD: 'qnzb uqzb drvk foxr',
    COOLDOWN_DURATION: 300000,
    MT_FILE: 'mt_texts.json',
    PREMIUM_FILE: 'premium_users.json',
    USER_DB: 'users.json',
    HISTORY_DB: 'history.json',
    SETTINGS_DB: 'settings.json',
    SUPPORT_USERNAME: 'A_b_d_Tb',
    DEVELOPER_USERNAME: 'A_b_d_Tb'
};

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: true });

console.log('🛡️ محارب الابتزاز - يعمل...');

// ============================================================
// 🎨 تأثيرات الشفافية (3 فقط - قصيرة)
// ============================================================

const effects = [
    '▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱',
    '▄▄▄▄▄▀▀▀▀▀▄▄▄▄▄▀▀▀▀▀',
    '✦✦✦✦✦✦✦✦✧✧✧✧✧✧✧✧'
];

const getEffect = () => effects[Math.floor(Math.random() * effects.length)];

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
// 📧 فحص البريد الوارد (مبسط)
// ============================================================

const autoCheck = async () => {
    // تم تعطيل الفحص التلقائي مؤقتاً لتجنب الأخطاء
    console.log('⏳ AutoCheck معطل');
};

// ============================================================
// 📝 أمر /start
// ============================================================

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    let user = get_user(userId);

    user.username = username;
    user.status = isOwner(userId) ? 'owner' : 'free';
    save_user(user);

    const effect = getEffect();

    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ إرسال /fix', callback_data: 'fix_menu' }],
            [{ text: '📝 معلومات الاستخدام', callback_data: 'help_menu' }],
            [{ text: '📊 إحصائياتي', callback_data: 'my_stats' }],
            [{ text: '💰 نقاط الإحالة', callback_data: 'my_points' }]
        ]
    };

    if (isOwner(userId)) {
        keyboard.inline_keyboard.push([
            [{ text: '⚙️ لوحة التحكم', callback_data: 'admin_panel' }]
        ]);
    }

    // استخدام sendMessage بدلاً من sendPhoto (لتجنب مشكلة caption الطويل)
    const message = 
effect + '\n' +
'🛡️ *محارب الابتزاز* 🛡️\n' +
effect + '\n\n' +
'👋 أهلاً بك ' + username + '!\n\n' +
'🆔 معرفك: `' + userId + '`\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix المتبقية: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n\n' +
'📌 *اختر من القائمة أدناه:*\n\n' +
'👤 *المطور:* @' + CONFIG.DEVELOPER_USERNAME + '\n' +
'📞 *الدعم:* @' + CONFIG.SUPPORT_USERNAME;

    await bot.sendMessage(userId, message, {
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
    const raw = match[1].trim();
    const number = raw.replace(/[^0-9+]/g, '');
    let user = get_user(userId);

    if (number.length < 5) {
        return bot.sendMessage(chatId, '❌ صيغة غير صحيحة. مثال: /fix +967XXXXXXXX');
    }

    const mtList = get_mt_texts();
    const activeMt = mtList.find(mt => mt.id === active_mt_id);
    if (!activeMt) {
        return bot.sendMessage(chatId, '❌ لا يوجد قالب MT نشط. استخدم /setmt لإضافة قالب.');
    }

    const emailCreds = get_active_email();
    if (!emailCreds.user || !emailCreds.pass) {
        return bot.sendMessage(chatId, '❌ لا يوجد بريد إلكتروني نشط.');
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

        const effect = getEffect();
        bot.sendMessage(chatId, 
effect + '\n' +
'✅ تم إرسال الطلب للرقم ' + number + '\n' +
'📧 البريد المستخدم: ' + emailCreds.user + '\n' +
'✅ متبقي لديك: ' + user.fix_limit + 'x\n' +
effect);

        save_history({
            user_id: userId,
            username: msg.from.username || 'N/A',
            command: '/fix ' + number,
            number_fixed: number.replace('+', ''),
            email_used: emailCreds.user
        });

    } catch (e) {
        bot.sendMessage(chatId, '❌ فشل الإرسال: ' + e.message);
    }
});

// ============================================================
// 🎯 معالج الأزرار
// ============================================================

bot.on('callback_query', async (call) => {
    const chatId = call.message.chat.id;
    const msgId = call.message.message_id;
    const data = call.data;
    const userId = call.from.id;

    const edit = async (text, keyboard) => {
        try {
            await bot.editMessageText(text, {
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

    const effect = getEffect();

    try {
        // ===== القائمة الرئيسية =====
        if (data === 'back_main') {
            const user = get_user(userId);
            const keyboard = {
                inline_keyboard: [
                    [{ text: '✅ إرسال /fix', callback_data: 'fix_menu' }],
                    [{ text: '📝 معلومات الاستخدام', callback_data: 'help_menu' }],
                    [{ text: '📊 إحصائياتي', callback_data: 'my_stats' }],
                    [{ text: '💰 نقاط الإحالة', callback_data: 'my_points' }]
                ]
            };
            if (isOwner(userId)) {
                keyboard.inline_keyboard.push([
                    [{ text: '⚙️ لوحة التحكم', callback_data: 'admin_panel' }]
                ]);
            }
            const message = 
effect + '\n' +
'🛡️ *محارب الابتزاز* 🛡️\n' +
effect + '\n\n' +
'👋 أهلاً بك ' + user.username + '!\n\n' +
'🆔 معرفك: `' + userId + '`\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix المتبقية: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n\n' +
'👤 *المطور:* @' + CONFIG.DEVELOPER_USERNAME + '\n' +
'📞 *الدعم:* @' + CONFIG.SUPPORT_USERNAME;
            await edit(message, keyboard);
            return;
        }

        // ===== قائمة /fix =====
        if (data === 'fix_menu') {
            const user = get_user(userId);
            await edit(
effect + '\n' +
'✅ **إرسال طلب /fix**\n\n' +
'📌 استخدم الأمر:\n`/fix +967XXXXXXXX`\n\n' +
'📊 عدد مرات /fix المتبقية: *' + user.fix_limit + 'x*\n' +
'⏱️ فترة التهدئة: *' + (cooldown_duration/60000) + ' دقيقة*\n\n' +
'💡 *مثال:* `/fix +967778220272`\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة للقائمة', callback_data: 'back_main' }]] });
            return;
        }

        // ===== معلومات الاستخدام =====
        if (data === 'help_menu') {
            await edit(
effect + '\n' +
'📖 *معلومات الاستخدام*\n\n' +
'🛡️ *محارب الابتزاز*\n' +
'هذا البوت يساعدك في إرسال طلبات استرداد الحسابات المحظورة.\n\n' +
'📌 *الأوامر:*\n' +
'• `/start` - القائمة الرئيسية\n' +
'• `/fix +967XXXXXXXX` - إرسال طلب\n\n' +
'👤 *المطور:* @' + CONFIG.DEVELOPER_USERNAME + '\n' +
'📞 *الدعم:* @' + CONFIG.SUPPORT_USERNAME + '\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'back_main' }]] });
            return;
        }

        // ===== الإحصائيات =====
        if (data === 'my_stats') {
            const user = get_user(userId);
            const history = readDB(CONFIG.HISTORY_DB).filter(h => h.user_id === userId);
            const totalFixes = history.length;

            await edit(
effect + '\n' +
'📊 *إحصائياتك*\n\n' +
'🆔 المعرف: `' + userId + '`\n' +
'👤 الاسم: @' + user.username + '\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n' +
'📝 عدد الطلبات: *' + totalFixes + '*\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'back_main' }]] });
            return;
        }

        // ===== نقاط الإحالة =====
        if (data === 'my_points') {
            const user = get_user(userId);
            await edit(
effect + '\n' +
'💰 *نقاط الإحالة*\n\n' +
'نقاطك الحالية: *' + user.referral_points + '*\n\n' +
'📌 كل مستخدم جديد ينضم عبر رابطك يمنحك *1 نقطة*\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'back_main' }]] });
            return;
        }

        // ============================================================
        // 👑 لوحة التحكم
        // ============================================================

        if (data === 'admin_panel') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 إدارة البريد', callback_data: 'admin_email' }],
                    [{ text: '📝 إدارة قوالب MT', callback_data: 'admin_mt' }],
                    [{ text: '👥 إدارة المستخدمين', callback_data: 'admin_user' }],
                    [{ text: '📊 إحصائيات البوت', callback_data: 'admin_stats' }],
                    [{ text: '🔙 العودة', callback_data: 'back_main' }]
                ]
            };
            await edit('👑 *لوحة التحكم*\n\n' + effect, keyboard);
            return;
        }

        // ===== إدارة البريد =====
        if (data === 'admin_email') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 إضافة بريد', callback_data: 'admin_add_email' }],
                    [{ text: '📋 قائمة البريدات', callback_data: 'admin_list_email' }],
                    [{ text: '🔄 تفعيل بريد', callback_data: 'admin_set_email' }],
                    [{ text: '🔙 العودة', callback_data: 'admin_panel' }]
                ]
            };
            await edit('📧 *إدارة البريد*', keyboard);
            return;
        }

        if (data === 'admin_add_email') {
            await bot.sendMessage(chatId, '📧 أرسل: `البريد|كلمة_المرور`');
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ صيغة غير صحيحة');
                }
                const [email, pass] = m.text.split('|').map(s => s.trim());
                const emails = readDB('emails.json');
                const newId = emails.length > 0 ? emails[emails.length - 1].id + 1 : 1;
                emails.push({ id: newId, email, app_pass: pass });
                writeDB('emails.json', emails);
                bot.sendMessage(chatId, '✅ تم إضافة **' + email + '** (ID: ' + newId + ')');
            });
            return;
        }

        if (data === 'admin_list_email') {
            const emails = readDB('emails.json');
            let txt = '📋 *قائمة البريدات*\n\n';
            txt += 'ID 0: ' + CONFIG.EMAIL_SENDER + (active_email_id === 0 ? ' ✅' : '') + '\n';
            emails.forEach(e => {
                txt += 'ID ' + e.id + ': ' + e.email + (e.id === active_email_id ? ' ✅' : '') + '\n';
            });
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_email' }]] });
            return;
        }

        if (data === 'admin_set_email') {
            await bot.sendMessage(chatId, '📧 أرسل رقم ID (مثال: `1`)');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ رقم غير صحيح');
                if (id === 0) {
                    updateSettings('active_email_id', 0);
                    return bot.sendMessage(chatId, '✅ تم تفعيل البريد الافتراضي');
                }
                const emails = readDB('emails.json');
                const found = emails.find(e => e.id === id);
                if (!found) return bot.sendMessage(chatId, '❌ البريد غير موجود');
                updateSettings('active_email_id', id);
                bot.sendMessage(chatId, '✅ تم تفعيل **' + found.email + '**');
            });
            return;
        }

        // ===== إدارة قوالب MT =====
        if (data === 'admin_mt') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📝 إضافة قالب', callback_data: 'admin_add_mt' }],
                    [{ text: '📋 قائمة القوالب', callback_data: 'admin_list_mt' }],
                    [{ text: '🔄 تفعيل قالب', callback_data: 'admin_set_mt' }],
                    [{ text: '🔙 العودة', callback_data: 'admin_panel' }]
                ]
            };
            await edit('📝 *إدارة قوالب MT*', keyboard);
            return;
        }

        if (data === 'admin_add_mt') {
            await bot.sendMessage(chatId, '📝 أرسل: `البريد|الموضوع|النص`\n*يجب أن يحتوي على {nomor}*');
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ صيغة غير صحيحة');
                }
                const [to, subject, body] = m.text.split('|').map(s => s.trim());
                if (!body.includes('{nomor}')) {
                    return bot.sendMessage(chatId, '❌ يجب أن يحتوي على {nomor}');
                }
                const list = get_mt_texts();
                const newId = list.length > 0 ? list[list.length - 1].id + 1 : 1;
                list.push({ id: newId, to_email: to, subject, body });
                writeDB(CONFIG.MT_FILE, list);
                bot.sendMessage(chatId, '✅ تم إضافة القالب (ID: ' + newId + ')');
            });
            return;
        }

        if (data === 'admin_list_mt') {
            const list = get_mt_texts();
            let txt = '📋 *قائمة القوالب*\n\n';
            list.forEach(mt => {
                txt += 'ID ' + mt.id + ': ' + mt.subject + ' → ' + mt.to_email + '\n';
            });
            if (!list.length) txt += 'لا توجد قوالب';
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_mt' }]] });
            return;
        }

        if (data === 'admin_set_mt') {
            await bot.sendMessage(chatId, '📝 أرسل رقم ID (مثال: `1`)');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ رقم غير صحيح');
                if (id === 0) {
                    updateSettings('active_mt_id', 0);
                    return bot.sendMessage(chatId, '❌ تم إلغاء التفعيل');
                }
                const found = get_mt_by_id(id);
                if (!found) return bot.sendMessage(chatId, '❌ القالب غير موجود');
                updateSettings('active_mt_id', id);
                bot.sendMessage(chatId, '✅ تم تفعيل القالب (ID: ' + id + ')');
            });
            return;
        }

        // ===== إدارة المستخدمين =====
        if (data === 'admin_user') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 قائمة المستخدمين', callback_data: 'admin_list_users' }],
                    [{ text: '🚫 حظر', callback_data: 'admin_ban' }],
                    [{ text: '🟢 إلغاء الحظر', callback_data: 'admin_unban' }],
                    [{ text: '🔙 العودة', callback_data: 'admin_panel' }]
                ]
            };
            await edit('👥 *إدارة المستخدمين*', keyboard);
            return;
        }

        if (data === 'admin_list_users') {
            const users = get_all_users();
            let txt = '📋 *قائمة المستخدمين*\n\n';
            users.slice(0, 20).forEach(u => {
                txt += 'ID: ' + u.id + ' | @' + u.username + ' | ' + u.status + ' | حد /fix: ' + u.fix_limit + 'x\n';
            });
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_user' }]] });
            return;
        }

        if (data === 'admin_ban') {
            await bot.sendMessage(chatId, '🚫 أرسل ID المستخدم');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ رقم غير صحيح');
                if (isOwner(id)) return bot.sendMessage(chatId, '❌ لا يمكن حظر المالك');
                const user = get_user(id);
                user.is_banned = 1;
                save_user(user);
                bot.sendMessage(chatId, '✅ تم حظر **' + id + '**');
            });
            return;
        }

        if (data === 'admin_unban') {
            await bot.sendMessage(chatId, '🟢 أرسل ID المستخدم');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ رقم غير صحيح');
                const user = get_user(id);
                user.is_banned = 0;
                save_user(user);
                bot.sendMessage(chatId, '✅ تم إلغاء حظر **' + id + '**');
            });
            return;
        }

        // ===== الإحصائيات العامة =====
        if (data === 'admin_stats') {
            const users = get_all_users();
            const total = users.length;
            const banned = users.filter(u => u.is_banned).length;
            const mtCount = get_mt_texts().length;
            const emailCount = readDB('emails.json').length;

            const txt = 
effect + '\n' +
'📊 *إحصائيات البوت*\n\n' +
'👥 المستخدمين: *' + total + '*\n' +
'🚫 المحظورين: *' + banned + '*\n' +
'📝 القوالب: *' + mtCount + '*\n' +
'📧 البريدات: *' + emailCount + '*\n' +
'⏱️ التهدئة: *' + (cooldown_duration/60000) + ' دقيقة*\n' +
effect;

            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_panel' }]] });
            return;
        }

        console.log('زر غير معروف:', data);

    } catch (e) {
        console.error('خطأ في الزر:', e.message);
        bot.answerCallbackQuery(call.id, { text: '❌ خطأ: ' + e.message, show_alert: true });
    }

    bot.answerCallbackQuery(call.id);
});

// ============================================================
// 🚀 التشغيل
// ============================================================

console.log('🛡️ محارب الابتزاز - يعمل...');
console.log('👤 المطور: @' + CONFIG.DEVELOPER_USERNAME);
console.log('📞 الدعم: @' + CONFIG.SUPPORT_USERNAME);

// تعطيل الفحص التلقائي مؤقتاً
// setInterval(autoCheck, 30000);
