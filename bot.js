// ============================================================
// 🤖 محارب الابتزاز - البوت المتكامل
// ============================================================
// 👤 المطور: @A_b_d_Tb
// 📞 تواصل: @A_b_d_Tb - @A_b_d_Tb
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
    SETTINGS_DB: 'settings.json'
};

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: true });

// حذف Webhook تلقائي
bot.deleteWebhook().then(() => {
    console.log('✅ Webhook deleted');
}).catch(() => {});

// ============================================================
// 🎨 تأثيرات الشفافية (3 فقط)
// ============================================================

const effects = [
    '▰'.repeat(15) + '▱'.repeat(15),
    '▄'.repeat(5) + '▀'.repeat(5) + '▄'.repeat(5) + '▀'.repeat(5),
    '✦'.repeat(8) + '✧'.repeat(8)
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
                    return reject(new Error('فشل فتح البريد: ' + err.message));
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
                        reject(new Error('فشل قراءة البريد: ' + err.message));
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

        const effect = getEffect();
        const msg = 
effect + '\n' +
'📣 **تم العثور على رد!**\n\n' +
'رقم الهاتف: **+' + number + '**\n\n' +
'**الموضوع:** ' + email.subject + '\n' +
'**التاريخ:** ' + new Date(email.date).toLocaleString('ar-EG') + '\n\n' +
'```\n' + body.substring(0, 500) + '...\n```\n' +
effect;

        await bot.sendMessage(entry.user_id, msg, { parse_mode: 'Markdown' });
        lastChecked = new Date(email.date);
        console.log('✅ تم إرسال الإشعار لـ +' + number);
    } catch (e) {
        console.error('خطأ في الفحص التلقائي:', e.message);
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
                bot.sendMessage(ref, '🎉 مستخدم جديد عبر رابطك! +1 نقطة. إجمالي نقاطك: ' + referrer.referral_points);
            }
        }
    }

    user.username = username;
    user.status = isOwner(userId) ? 'owner' : 'free';
    save_user(user);

    const botInfo = await bot.getMe();
    const link = 'https://t.me/' + botInfo.username + '?start=' + userId;

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
            [{ text: '⚙️ لوحة التحكم', callback_data: 'admin_panel' },
            { text: '📧 البريد الإلكتروني', callback_data: 'admin_email' }]
        ]);
        keyboard.inline_keyboard.push([
            [{ text: '📝 قوالب MT', callback_data: 'admin_mt' },
            { text: '👥 المستخدمون', callback_data: 'admin_user' }]
        ]);
    }

    const caption = 
effect + '\n' +
'🛡️ *محارب الابتزاز* 🛡️\n' +
effect + '\n\n' +
'👋 أهلاً بك ' + username + '!\n\n' +
'🆔 معرفك: `' + userId + '`\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix المتبقية: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n\n' +
'🔗 رابط الدعوة الخاص بك:\n`' + link + '`\n\n' +
effect + '\n\n' +
'📌 *اختر من القائمة أدناه:*';

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
        return bot.sendMessage(chatId, '❌ صيغة غير صحيحة. مثال: /fix +967XXXXXXXX');
    }

    const mtList = get_mt_texts();
    const activeMt = mtList.find(mt => mt.id === active_mt_id);
    if (!activeMt) {
        return bot.sendMessage(chatId, '❌ لا يوجد قالب MT نشط. يجب على المشرف تفعيل أحد القوالب.');
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
            username: username,
            command: '/fix ' + number,
            number_fixed: number.replace('+', ''),
            email_used: emailCreds.user
        });

        autoCheck();
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

    const effect = getEffect();

    try {
        // ===== القائمة الرئيسية =====
        if (data === 'back_main') {
            const user = get_user(userId);
            const botInfo = await bot.getMe();
            const link = 'https://t.me/' + botInfo.username + '?start=' + userId;
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
                    [{ text: '⚙️ لوحة التحكم', callback_data: 'admin_panel' },
                    { text: '📧 البريد الإلكتروني', callback_data: 'admin_email' }]
                ]);
                keyboard.inline_keyboard.push([
                    [{ text: '📝 قوالب MT', callback_data: 'admin_mt' },
                    { text: '👥 المستخدمون', callback_data: 'admin_user' }]
                ]);
            }
            const caption = 
effect + '\n' +
'🛡️ *محارب الابتزاز* 🛡️\n' +
effect + '\n\n' +
'👋 أهلاً بك ' + user.username + '!\n\n' +
'🆔 معرفك: `' + userId + '`\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix المتبقية: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n\n' +
'🔗 رابط الدعوة الخاص بك:\n`' + link + '`';
            await edit(caption, keyboard);
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
'هذا البوت يساعدك في إرسال طلبات استرداد الحسابات المحظورة عبر البريد الإلكتروني.\n\n' +
'📌 *الأوامر المتاحة:*\n' +
'• `/start` - عرض القائمة الرئيسية\n' +
'• `/fix <رقم>` - إرسال طلب استرداد\n' +
'• `/fix +967XXXXXXXX` - مثال\n\n' +
'🔑 *كيف يعمل؟*\n' +
'1️⃣ أرسل رقم الهاتف مع كود الدولة\n' +
'2️⃣ سيتم إرسال بريد إلكتروني تلقائي\n' +
'3️⃣ سيتم فحص الردود تلقائياً\n\n' +
'💰 *نظام النقاط:*\n' +
'• ادعُ أصدقاءك عبر رابط الدعوة\n' +
'• احصل على نقاط إضافية\n' +
'• استخدم النقاط لزيادة عدد مرات /fix\n\n' +
'👤 *المطور:* @A_b_d_Tb\n' +
'📞 *الدعم:* @A_b_d_Tb - @A_b_d_Tb\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة للقائمة', callback_data: 'back_main' }]] });
            return;
        }

        // ===== الإحصائيات =====
        if (data === 'my_stats') {
            const user = get_user(userId);
            const history = readDB(CONFIG.HISTORY_DB).filter(h => h.user_id === userId);
            const totalFixes = history.length;
            const lastFix = history.length > 0 ? new Date(history[history.length - 1].timestamp).toLocaleString('ar-EG') : 'لا يوجد';

            await edit(
effect + '\n' +
'📊 *إحصائياتك*\n\n' +
'🆔 المعرف: `' + userId + '`\n' +
'👤 الاسم: @' + user.username + '\n' +
'📊 الحالة: *' + user.status.toUpperCase() + '*\n' +
'✅ عدد مرات /fix: *' + user.fix_limit + 'x*\n' +
'💰 نقاط الإحالة: *' + user.referral_points + '*\n' +
'📝 عدد الطلبات: *' + totalFixes + '*\n' +
'🕐 آخر طلب: ' + lastFix + '\n' +
'🚫 الحظر: ' + (user.is_banned ? '✅ محظور' : '❌ غير محظور') + '\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة للقائمة', callback_data: 'back_main' }]] });
            return;
        }

        // ===== نقاط الإحالة =====
        if (data === 'my_points') {
            const user = get_user(userId);
            const botInfo = await bot.getMe();
            const link = 'https://t.me/' + botInfo.username + '?start=' + userId;

            await edit(
effect + '\n' +
'💰 *نقاط الإحالة*\n\n' +
'نقاطك الحالية: *' + user.referral_points + '*\n\n' +
'📌 *كيف تحصل على نقاط؟*\n' +
'• شارك رابط الدعوة الخاص بك مع أصدقائك\n' +
'• كل مستخدم جديد ينضم عبر رابطك يمنحك *1 نقطة*\n\n' +
'🔗 *رابط الدعوة الخاص بك:*\n`' + link + '`\n\n' +
'💡 *استخدم النقاط لزيادة عدد مرات /fix*\n' +
effect,
                { inline_keyboard: [[{ text: '🔙 العودة للقائمة', callback_data: 'back_main' }]] });
            return;
        }

        // ============================================================
        // 👑 لوحة التحكم
        // ============================================================

        if (data === 'admin_panel') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 إدارة البريد الإلكتروني', callback_data: 'admin_email' }],
                    [{ text: '📝 إدارة قوالب MT', callback_data: 'admin_mt' }],
                    [{ text: '👥 إدارة المستخدمين', callback_data: 'admin_user' }],
                    [{ text: '📊 إحصائيات البوت', callback_data: 'admin_stats' }],
                    [{ text: '🔙 العودة للقائمة', callback_data: 'back_main' }]
                ]
            };
            await edit(
effect + '\n' +
'👑 *لوحة التحكم*\n\n' +
effect + '\n\n' +
'اختر الإجراء المناسب:',
                keyboard);
            return;
        }

        // ===== إدارة البريد الإلكتروني =====
        if (data === 'admin_email') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📧 إضافة بريد جديد', callback_data: 'admin_add_email' }],
                    [{ text: '📋 قائمة البريدات', callback_data: 'admin_list_email' }],
                    [{ text: '🔄 تفعيل بريد', callback_data: 'admin_set_email' }],
                    [{ text: '🔙 العودة للوحة', callback_data: 'admin_panel' }]
                ]
            };
            await edit(
effect + '\n' +
'📧 *إدارة البريد الإلكتروني*\n' +
effect,
                keyboard);
            return;
        }

        if (data === 'admin_add_email') {
            await bot.sendMessage(chatId, '📧 أرسل البريد الإلكتروني وكلمة المرور بهذا الشكل:\n`البريد|كلمة_المرور`\n\nمثال:\n`example@gmail.com|abcd1234efgh5678`', { parse_mode: 'Markdown' });
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ صيغة غير صحيحة. استخدم: البريد|كلمة_المرور');
                }
                const [email, pass] = m.text.split('|').map(s => s.trim());
                const emails = readDB('emails.json');
                const newId = emails.length > 0 ? emails[emails.length - 1].id + 1 : 1;
                emails.push({ id: newId, email, app_pass: pass });
                writeDB('emails.json', emails);
                const effect2 = getEffect();
                bot.sendMessage(chatId, 
effect2 + '\n' +
'✅ تمت إضافة البريد **' + email + '** (ID: ' + newId + ')\n' +
effect2);
            });
            return;
        }

        if (data === 'admin_list_email') {
            const emails = readDB('emails.json');
            let txt = effect + '\n📋 *قائمة البريدات المسجلة*\n\n';
            txt += '🆔 0: ' + CONFIG.EMAIL_SENDER + (active_email_id === 0 ? ' ✅ نشط' : '') + '\n';
            emails.forEach(e => {
                txt += '🆔 ' + e.id + ': ' + e.email + (e.id === active_email_id ? ' ✅ نشط' : '') + '\n';
            });
            txt += '\n' + effect;
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_email' }]] });
            return;
        }

        if (data === 'admin_set_email') {
            await bot.sendMessage(chatId, '📧 أرسل رقم ID للبريد الذي تريد تفعيله\n(مثال: `1` أو `0` للبريد الافتراضي)', { parse_mode: 'Markdown' });
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ يجب إرسال رقم');
                if (id === 0) {
                    updateSettings('active_email_id', 0);
                    const effect2 = getEffect();
                    return bot.sendMessage(chatId, effect2 + '\n✅ تم تفعيل البريد الافتراضي\n' + effect2);
                }
                const emails = readDB('emails.json');
                const found = emails.find(e => e.id === id);
                if (!found) return bot.sendMessage(chatId, '❌ البريد غير موجود');
                updateSettings('active_email_id', id);
                const effect2 = getEffect();
                bot.sendMessage(chatId, effect2 + '\n✅ تم تفعيل البريد **' + found.email + '**\n' + effect2);
            });
            return;
        }

        // ===== إدارة قوالب MT =====
        if (data === 'admin_mt') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📝 إضافة قالب MT', callback_data: 'admin_add_mt' }],
                    [{ text: '📋 قائمة القوالب', callback_data: 'admin_list_mt' }],
                    [{ text: '🔄 تفعيل قالب', callback_data: 'admin_set_mt' }],
                    [{ text: '🔙 العودة للوحة', callback_data: 'admin_panel' }]
                ]
            };
            await edit(
effect + '\n' +
'📝 *إدارة قوالب MT*\n' +
effect,
                keyboard);
            return;
        }

        if (data === 'admin_add_mt') {
            await bot.sendMessage(chatId, '📝 أرسل القالب بهذا الشكل:\n`البريد_المستهدف|الموضوع|نص_الرسالة`\n\n*يجب أن يحتوي النص على {nomor}*', { parse_mode: 'Markdown' });
            bot.once('message', async (m) => {
                if (!m.text || !m.text.includes('|')) {
                    return bot.sendMessage(chatId, '❌ صيغة غير صحيحة. استخدم: البريد|الموضوع|النص');
                }
                const [to, subject, body] = m.text.split('|').map(s => s.trim());
                if (!body.includes('{nomor}')) {
                    return bot.sendMessage(chatId, '❌ يجب أن يحتوي النص على {nomor}');
                }
                const list = get_mt_texts();
                const newId = list.length > 0 ? list[list.length - 1].id + 1 : 1;
                list.push({ id: newId, to_email: to, subject, body });
                writeDB(CONFIG.MT_FILE, list);
                const effect2 = getEffect();
                bot.sendMessage(chatId, effect2 + '\n✅ تمت إضافة القالب MT (ID: ' + newId + ')\n' + effect2);
            });
            return;
        }

        if (data === 'admin_list_mt') {
            const list = get_mt_texts();
            let txt = effect + '\n📋 *قائمة قوالب MT*\n\n';
            list.forEach(mt => {
                txt += '🆔 ' + mt.id + ': ' + mt.subject + ' → ' + mt.to_email + '\n';
            });
            if (!list.length) txt += 'لا توجد قوالب';
            txt += '\n' + effect;
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_mt' }]] });
            return;
        }

        if (data === 'admin_set_mt') {
            await bot.sendMessage(chatId, '📝 أرسل رقم ID للقالب الذي تريد تفعيله\n(مثال: `1` أو `0` لإلغاء التفعيل)', { parse_mode: 'Markdown' });
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ يجب إرسال رقم');
                if (id === 0) {
                    updateSettings('active_mt_id', 0);
                    const effect2 = getEffect();
                    return bot.sendMessage(chatId, effect2 + '\n❌ تم إلغاء تفعيل القالب\n' + effect2);
                }
                const found = get_mt_by_id(id);
                if (!found) return bot.sendMessage(chatId, '❌ القالب غير موجود');
                updateSettings('active_mt_id', id);
                const effect2 = getEffect();
                bot.sendMessage(chatId, effect2 + '\n✅ تم تفعيل القالب (ID: ' + id + ')\n' + effect2);
            });
            return;
        }

        // ===== إدارة المستخدمين =====
        if (data === 'admin_user') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 قائمة المستخدمين', callback_data: 'admin_list_users' }],
                    [{ text: '🚫 حظر مستخدم', callback_data: 'admin_ban' }],
                    [{ text: '🟢 إلغاء الحظر', callback_data: 'admin_unban' }],
                    [{ text: '🔙 العودة للوحة', callback_data: 'admin_panel' }]
                ]
            };
            await edit(
effect + '\n' +
'👥 *إدارة المستخدمين*\n' +
effect,
                keyboard);
            return;
        }

        if (data === 'admin_list_users') {
            const users = get_all_users();
            let txt = effect + '\n📋 *قائمة المستخدمين*\n\n';
            users.slice(0, 20).forEach(u => {
                txt += '🆔 ' + u.id + ' | @' + u.username + ' | ' + u.status + ' | حد /fix: ' + u.fix_limit + 'x\n';
            });
            if (users.length > 20) txt += '\n... و ' + (users.length - 20) + ' مستخدم آخر';
            txt += '\n' + effect;
            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'admin_user' }]] });
            return;
        }

        if (data === 'admin_ban') {
            await bot.sendMessage(chatId, '🚫 أرسل ID المستخدم للحظر');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ يجب إرسال رقم');
                if (isOwner(id)) return bot.sendMessage(chatId, '❌ لا يمكن حظر المالك');
                const user = get_user(id);
                user.is_banned = 1;
                save_user(user);
                const effect2 = getEffect();
                bot.sendMessage(chatId, effect2 + '\n✅ تم حظر المستخدم **' + id + '**\n' + effect2);
            });
            return;
        }

        if (data === 'admin_unban') {
            await bot.sendMessage(chatId, '🟢 أرسل ID المستخدم لإلغاء الحظر');
            bot.once('message', async (m) => {
                const id = parseInt(m.text);
                if (isNaN(id)) return bot.sendMessage(chatId, '❌ يجب إرسال رقم');
                const user = get_user(id);
                user.is_banned = 0;
                save_user(user);
                const effect2 = getEffect();
                bot.sendMessage(chatId, effect2 + '\n✅ تم إلغاء حظر المستخدم **' + id + '**\n' + effect2);
            });
            return;
        }

        // ===== الإحصائيات العامة =====
        if (data === 'admin_stats') {
            const users = get_all_users();
            const total = users.length;
            const banned = users.filter(u => u.is_banned).length;
            const owners = users.filter(u => u.status === 'owner').length;
            const mtCount = get_mt_texts().length;
            const emailCount = readDB('emails.json').length;
            const historyCount = readDB(CONFIG.HISTORY_DB).length;

            const txt = 
effect + '\n' +
'📊 *إحصائيات البوت*\n\n' +
'👥 إجمالي المستخدمين: *' + total + '*\n' +
'👑 المالكين: *' + owners + '*\n' +
'🚫 المحظورين: *' + banned + '*\n' +
'📝 قوالب MT: *' + mtCount + '*\n' +
'📧 البريدات: *' + emailCount + '*\n' +
'📜 عدد الطلبات: *' + historyCount + '*\n' +
'⏱️ فترة التهدئة: *' + (cooldown_duration/60000) + ' دقيقة*\n' +
effect;

            await edit(txt, { inline_keyboard: [[{ text: '🔙 العودة للوحة', callback_data: 'admin_panel' }]] });
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

console.log('🛡️ محارب الابتزاز - يعمل على Render...');
console.log('═══════════════════════════════════════════════');
console.log('🎨 3 تأثيرات فقط: شريط، تدرج، نجوم');
console.log('👤 المطور: @A_b_d_Tb');
console.log('📞 الدعم: @A_b_d_Tb - @A_b_d_Tb');
console.log('═══════════════════════════════════════════════');

setInterval(autoCheck, 30000);