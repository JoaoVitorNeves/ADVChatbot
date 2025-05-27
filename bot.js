const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');


const TEXTO_FINAL_PADRAO = 'Nosso atendimento automático foi encerrado.\nAgradecemos o seu contato! Um especialista do Escritório da Dra. Paula Marcula irá continuar com você em breve.\nCaso precise de algo mais, estamos à disposição.';
const client = new Client();
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
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

client.on('message_create', async message => {
    if (message.fromMe) return; // Ignora mensagens do próprio bot

    const user = message.from;
    const msg = message.body.toLowerCase().trim();

    if (bloqueados.has(user)) return;

    if (!userState.has(user)) {
        userState.set(user, 'pergunta_inicial');
        return client.sendMessage(user, 'Olá! Seja bem-vindo(a) ao atendimento jurídico do Escritório da Dra. Paula Marcula, especialista em Direito Previdenciário.\nVocê teve algum benefício negado pelo INSS ou conhece alguém que teve ?\n1-Sim ou 2-Não');
    }

    const estado = userState.get(user);

    if (estado === 'pergunta_inicial') {
        if (msg === '1') {
            userState.set(user, 'pergunta_beneficio');
            return message.reply('\n📌 Ter um benefício do INSS negado não significa que você perdeu o direito.\nNa verdade, milhares de segurados têm seus pedidos indeferidos por falhas do próprio INSS — e a grande maioria consegue reverter essa situação com o apoio jurídico adequado.\n👉 Posso te ajudar com isso. Me diga:\n📍 Qual benefício você solicitou e foi negado?\n\n1 Aposentadoria\n2 Auxílio-doença\n3 BPC/LOAS\n4 Pensão por morte\n5 Outro');
        } else if(msg === '2'){
            textoFinal= 'Nosso atendimento automático foi encerrado.\nAgradecemos o seu contato! Um especialista do Escritório da Dra. Paula Marcula irá continuar com você em breve.\nCaso precise de algo mais, estamos à disposição.';

            return finalizarContato(user, message, textoFinal);
        }
        else {// add else if da opção não que bloqueia o user
           // userState.delete(user); //removido para não precisar do while e voltar para a pergunta de sim ou não enqunto não responder uma questão valida
            return client.sendMessage(user, 'Opção invalida! Escolha 1 para Sim ou 2 para Não');
        }
    }

    if (estado === 'pergunta_beneficio') {
        if (msg === '1') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Aposentadoria.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        }else if(msg === '2') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Auxílio-doença.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        }else if(msg === '3') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou BPC/LOAS.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        }else if(msg === '4') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, 'Você selecionou Pensão por morte.\n📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        }else if(msg === '5') {
            userState.set(user, 'pergunta_documento');
            await client.sendMessage(user, '📄 Você possui a carta de indeferimento ou o comprovante do pedido negado?');
            return client.sendMessage(user, '1 - Sim, posso enviar agora\n2 - Sim, envio depois\n3 - Não tenho');
        }else {

            return client.sendMessage(user, 'Opção invalida! Escolha uma das Cinco opçoes.');
        }
    }

    if (estado === 'pergunta_documento') {
        if (['1', '2'].includes(msg)) {
             respostaFinal = 'Perfeito! Por favor, envie a carta para que possamos analisá-la. Em breve, um advogado especializado entrará em contato com você para dar continuidade ao atendimento.';
             return finalizarContato(user, message, respostaFinal);
        }else if(msg === '3'){
            respostaFinal = 'Sem problemas! Podemos te orientar mesmo assim.\n📌 Me informe, por gentileza:\n– Seu nome completo\n– Seu CPF\n– Número do benefício ou protocolo (se souber)/n– O que o INSS alegou para negar';
            return finalizarContato(user, message, respostaFinal);
        } else {
            
            return client.sendMessage(user, 'Por favor, responda com 1, 2 ou 3.');
        }
    }
    




});

function finalizarContato(user, message, textoFinal) {
    message.reply(textoFinal);
    bloqueados.add(user);
    userState.delete(user);
    salvarBloqueados();
}

function salvarBloqueados() {
    fs.writeFileSync(BLOQUEADOS_FILE, JSON.stringify([...bloqueados]));
}
