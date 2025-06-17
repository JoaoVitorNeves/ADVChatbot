const { Client, LocalAuth } = require('whatsapp-web.js'); // <-- Alterado aqui
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const app = express();
const multer = require('multer');
const axios = require('axios');
const http = require('http');
const { use } = require('react');
const server = http.createServer(app);
app.use(express.json());

let isConnected = false;

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const upload = multer({ storage: multer.memoryStorage() });

const client = new Client({ // <-- Aqui está o LocalAuth
    authStrategy: new LocalAuth()
});

const BLOQUEADOS_FILE = 'bloqueados.json';

let bloqueados = new Set();
if (fs.existsSync(BLOQUEADOS_FILE)) {
    const dados = JSON.parse(fs.readFileSync(BLOQUEADOS_FILE));
    bloqueados = new Set(dados);
} else {
    fs.writeFileSync(BLOQUEADOS_FILE, JSON.stringify([]));
}

const userState = new Map(); //controle de estado

client.on('ready', () => {
    console.log('Client is ready!');
    isConnected = true;
    io.emit('ready');
});

client.on('qr', (qr) => {
    isConnected = false;
    qrcode.generate(qr, { small: true });
    io.emit('qr', qr);
});

client.initialize();
app.use(cors());

app.get('/status', (req, res) => {
    res.json({ isConnected: isConnected });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(require.resolve('socket.io-client/dist/socket.io.js'));
});

client.on('disconnected', (reason) => {
    console.log('Cliente desconectado');
    isConnected = false;
    io.emit('disconnected');

    client.on('qr', (qr) => {
        isConnected = false;
        qrcode.generate(qr, { small: true });
        io.emit('qr', qr);
    });

    client.initialize();
});

client.on('message_create', async message => {
    if (message.body.toLowerCase().trim() === '#adv') {
    const chat = await message.getChat();

    if (chat.isGroup) {
        return message.reply('❌ Este comando só funciona em conversas privadas.');
    }

    const contato = chat.id._serialized;

    if (bloqueados.has(contato)) {
        return;
    }

    bloqueados.add(contato);
    userState.delete(contato);
    salvarBloqueados();

    
}
    if (message.fromMe) return  // Ignora mensagens do próprio bot

    if (message.type === 'audio' || message.type === 'ptt') {
        console.log('Áudio ignorado.');
        return;
    }


    const user = message.from;
    const msg = message.body.toLowerCase().trim();

    if (bloqueados.has(user)) return;

    if (!userState.has(user)) {
        userState.set(user, 'pergunta_inicial');
        return client.sendMessage(user, 'Olá! Seja bem-vindo(a) ao atendimento jurídico do Escritório da Dra. Paula Marcula, especialista em Direito Previdenciário.\nVocê teve algum benefício negado pelo INSS ou conhece alguém que teve ?\n 1️⃣ Sim   2️⃣ Não');
    }

    const estado = userState.get(user);

    if (estado === 'pergunta_inicial') {
        if (msg === '1') {
            userState.set(user, 'pergunta_beneficio');
            return message.reply('\n📌 Ter um benefício do INSS negado não significa que você perdeu o direito.\nNa verdade, milhares de segurados têm seus pedidos indeferidos por falhas do próprio INSS — e a grande maioria consegue reverter essa situação com o apoio jurídico adequado.\n👉 Posso te ajudar com isso. Me diga:\n📍 Qual benefício você solicitou e foi negado?\n\n1 Aposentadoria\n2 Auxílio-doença\n3 BPC/LOAS\n4 Pensão por morte\n5 Outro');
        } 
        else if(msg === '2'){
            userState.set(user, 'pergunta_ajuda');
            return message.reply('Que bom saber disso! 😊 \n  Nosso escritório atua com excelência em diversas áreas do Direito, sempre com atendimento humanizado e estratégico. \n Existe alguma outra situação jurídica em que possamos te ajudar? \n \n Digite: \n  1️⃣ Sim \n  2️⃣ Não');
        }
        else {
            return client.sendMessage(user, 'Opção invalida! Escolha 1 para Sim ou 2 para Não');
        }
    }

    if (estado === 'pergunta_ajuda') {
        if (msg === '1') {
            respostaFinal = 'Perfeito! ✨\nPor favor, nos diga brevemente qual é a sua necessidade. Assim, um(a) advogado(a) especializado(a) entrará em contato para te orientar com todo o cuidado e profissionalismo que você merece.\nFicamos no aguardo da sua mensagem! 💬';
            return finalizarContato(user, message, respostaFinal);
        } else if (msg === '2') {
            userState.set(user, 'menu_final');
            return message.reply('Tudo bem, entendemos perfeitamente. 😊\nSe, no futuro, surgir qualquer dúvida ou necessidade jurídica, conte conosco. Será um prazer te ajudar!\n\nCaso deseje voltar ao menu inicial, digite:\n1️⃣ Voltar ao menu\n2️⃣ Encerrar atendimento');
        } else {
            return client.sendMessage(user, 'Opção inválida! Escolha 1 para Sim ou 2 para Não.');
        }
    }

    if (estado === 'menu_final') {
        if (msg === '1') {
            userState.delete(user);
            return message.reply('Você retornou ao menu inicial. Digite 1 para começar novamente.');
        } else if (msg === '2') {
            respostaFinal = 'Agradecemos o seu contato. Caso tenha mais alguma dúvida ou precise de novos esclarecimentos, estamos à disposição. Tenha um excelente dia!';
            return finalizarContato(user, message, respostaFinal);
        } else {
            return client.sendMessage(user, 'Opção inválida! Escolha 1 para voltar ao menu ou 2 para encerrar o atendimento.');
        }
    }

    if (estado === 'pergunta_beneficio') {
        if (msg === '1') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Aposentadoria.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        } else if (msg === '2') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Auxílio-doença.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        } else if (msg === '3') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou BPC/LOAS.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        } else if (msg === '4') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Pensão por morte.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        } else if (msg === '5') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, '📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        } else {
            return client.sendMessage(user, 'Opção invalida! Escolha uma das Cinco opçoes.');
        }
    }

    if (estado === 'pergunta_documento') {
        if (['1', '2'].includes(msg)) {
            userState.set(user, 'aguardando_dados');
            await message.reply(
                'Perfeito! Por favor, envie a carta para que possamos analisá-la. Em breve, um advogado especializado entrará em contato com você para dar continuidade ao atendimento.\n\nCaso deseje voltar ao menu inicial, digite:\n1️⃣ Voltar ao menu\n2️⃣ Encerrar atendimento'
            );
            return;
        } else if (msg === '3') {
            userState.set(user, 'aguardando_dados');
            await message.reply(
                'Sem problemas! Podemos te orientar mesmo assim.\n📌 Me informe, por gentileza:\n– Seu nome completo\n– Seu CPF\n– Número do benefício ou protocolo (se souber)\n– O que o INSS alegou para negar\n\nCaso deseje voltar ao menu inicial, digite:\n1️⃣ Voltar ao menu\n2️⃣ Encerrar atendimento'
            );
            return;
        } else {
            return client.sendMessage(user, 'Por favor, responda com 1, 2 ou 3.');
        }
    }

    if (estado === 'aguardando_dados') {
        if (msg === '1') {
            userState.delete(user);
            return message.reply('Você retornou ao menu inicial. Digite 1 para começar novamente.');
        } else if (msg === '2') {
            respostaFinal = 'Agradecemos o seu contato. Caso tenha mais alguma dúvida ou precise de novos esclarecimentos, estamos à disposição. Tenha um excelente dia!';
            return finalizarContato(user, message, respostaFinal);
        } else {
            return client.sendMessage(user, 'Mensagem recebida! Assim que possível, um advogado especializado entrará em contato. Caso deseje voltar ao menu, digite 1. Para encerrar, digite 2.');
        }
    }
});

function finalizarContato(user, message, textoFinal) {
    message.reply(textoFinal);
    bloqueados.add(user);
    userState.delete(user);
    salvarBloqueados();
};

function salvarBloqueados() {
    fs.writeFileSync(BLOQUEADOS_FILE, JSON.stringify([...bloqueados]));
}

server.listen(3333, () => {
    console.log('Servidor rodando na porta 3333');
});
