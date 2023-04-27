const TelegramBot = require('node-telegram-bot-api');
const token = ''//your bot key;
const bot = new TelegramBot(token, {polling: true});

let updates = [];
let updateBuffer = {};
timedUpdates(updates);

// recibe comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(chatId);
    bot.sendMessage(chatId, 'Escribe "\/estado" para iniciar el servicio de actualizaciones de cortes de luz');
});


// Se incicia recibiendo comando /estado

bot.onText(/\/estado/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Qué empresa de energía eléctrica te interesa?', {reply_markup: {
        inline_keyboard: [
            [
                {text: 'Edesur', callback_data: 'Edesur'},
                {text: 'Edenor', callback_data: 'Edenor'}
            ]
        ]
    }});
});


// Maneja todos los callback queries, es decir, los botones que se presionan
bot.on('callback_query', (callbackQuery) => {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    if(action == 'si'){
        addUpdate(chatId, updateBuffer.chatId, updates);
        
    }
    else if(action == 'no'){
        bot.sendMessage(chatId, 'No recibirás actualizaciones');
    }
    else if(action == 'basta'){
        bot.sendMessage(chatId, 'Dejarás de recibir actualizaciones');
        removeUpdate(chatId, updates);
    }
    else if(action == 'Edesur' || action == 'Edenor'){
        bot.sendMessage(chatId, 'Escribe una localidad para ver los cortes de luz')
        .then(async ()=> {
            bot.once('message', async (msg) => {
            const message = msg.text;
            const cortes = await fetchCortes(message, action);
            if(cortes == null) return bot.sendMessage(chatId, 'No hay cortes registrados en esta localidad.');
            let response = 'Cortes registrados en la localidad: ' + cortes.length +'\n' + 'Horario estimado de normalización:' + '\n';
            let update = {
               [chatId]: message
            } 
            updateBuffer.chatId= message;
            for(let i = 0; i < cortes.length; i++){
                const horaNormalizacion = cortes[i].match(new RegExp('\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}'));
                response = response + horaNormalizacion[0] + '\n'
            }
            bot.sendMessage(chatId, response).then(() => {
                bot.sendMessage(chatId, 'Querés recibir actualizaciones del servicio?', {reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Si', callback_data: 'si'},
                            {text: 'No', callback_data: 'no'}
                        ]
                    ]
                }})
            });
            });
        });
    }
    
});


// busca si hay cortes en la localidad
async function fetchCortes (localidad,empresa) {
    const urlEdesur = 'https://www.enre.gov.ar/paginacorte/js/data_EDS.js';
    const urlEdenor = 'https://www.enre.gov.ar/paginacorte/js/data_EDN.js';
    let urlFetch = '';
    if(empresa == 'Edesur') urlFetch = urlEdesur;
    else if(empresa == 'Edenor') urlFetch = urlEdenor;
    return fetch(urlFetch)
    .then(response => response.text())
    .then(text => {
    // extrae como texto el JSON de la página (no se puede extraer directamente como JSON)
    const jsonStart = text.indexOf('cortesServicioMedia');
    const jsonEnd = text.lastIndexOf('cortesComunicados');
    const jsonData = text.substring(jsonStart, jsonEnd -7);

    const data = JSON.parse(JSON.stringify(jsonData))
    const searchStr = localidad.toUpperCase();
    console.log(searchStr);
    const cortes = data.match(new RegExp(`${searchStr}(.|\n)*?\}`,'g'));
    console.log(cortes);
    return cortes;
    })
    .catch(error => {
    // handle error
    console.error(error);
    });
}

// agrega un update a la lista de updates
function addUpdate(chatId, localidad, updates){
    const update = {
        chatId: chatId,
        localidad: localidad
    }
    updates.push(update);
}

// remueve un update de la lista de updates
function removeUpdate(chatId, updates){
    for(let i = 0; i < updates.length; i++){
        if(updates[i].chatId == chatId){
            updates.splice(i, 1);
        }
    }
}

// envía actualizaciones a los usuarios
async function sendUpdates(updates){
    for(let i = 0; i < updates.length; i++){
        const cortes = await fetchCortes(updates[i].localidad);
        if(cortes == null) {
            bot.sendMessage(updates[i].chatId, 'No hay cortes registrados en esta localidad.');
            removeUpdate(updates[i].chatId, updates);
            continue;
        }
        let response = 'Cortes registrados en la localidad: ' + cortes.length +'\n' + 'Horario estimado de normalización:' + '\n';
        for(let i = 0; i < cortes.length; i++){
            const horaNormalizacion = cortes[i].match(new RegExp('\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}'));
            response = response + horaNormalizacion[0] + '\n'
        }
        bot.sendMessage(updates[i].chatId, response).then(()=>{
            bot.sendMessage(updates[i].chatId, 'Querés dejar de recibir actualizaciones del servicio?', {reply_markup: {
                inline_keyboard: [
                    [
                        {text: 'Si', callback_data: 'basta'},
                        {text: 'No', callback_data: 'sigue'}
                    ]
                ]
            }})
        });
    }
}

// limpia el buffer de actualizaciones
function clearBuffer(updateBuffer){
    for(let i = 0; i < updateBuffer.length; i++){
        updateBuffer.splice(i, 1);
    }
}

// envía actualizaciones a los usuarios cada 15 minutos y limpia el buffer
async function timedUpdates(updates){
    setInterval(async () => {
        clearBuffer(updateBuffer);
        await sendUpdates(updates);
    },900000);
}


