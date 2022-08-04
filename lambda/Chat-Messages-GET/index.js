'use strict';
//esperamos receber o id da conversa
var AWS = require('aws-sdk');

var dynamo = new AWS.DynamoDB(); //cria o cliente dynamo

exports.handler = function (event, context, callback) {
    dynamo.query({
        TableName: 'Chat-Messages', //acessa a tabela
        ProjectionExpression: '#T, Sender, Message', //a expressão que será enviada
        ExpressionAttributeNames: {'#T': 'Timestamp'}, //define o #t como timestamp
        KeyConditionExpression: 'ConversationId = :id', //a chave será o id da conversa
        ExpressionAttributeValues: {':id': {S: event.id}} //passa como string
    }, function (err, data) {
        loadMessages(err, data, event.id, [], event.cognitoUsername, callback);
    });
}

function loadMessages(err, data, id, messages, username, callback) { //erros, a informação, o id, a lista das mensagens recebidas, e o retorno da função lambda toda
    if (err === null) { //se não tiver erro continua, se tiver erro, mostra esses erros
        data.Items.forEach(function (message) { //monta um array das mensagens
            messages.push({
                sender: message.Sender.S, //quem mandou
                time: Number(message.Timestamp.N), //o timestamp que é a hora
                message: message.Message.S //a mensagem
            }); 
        });
        if(data.LastEvaluatedKey) { //pra mostrar todas as mensagens, verifica se é a ultima e constroi de novo se não for
            dynamo.query({
                TableName: 'Chat-Messages',
                ProjectionExpression: '#T, Sender, Message',
                KeyConditionExpression: 'ConversationId = :id',
                ExpressionAttributeNames: {'#T': 'Timestamp'},
                ExpressionAttributeValues: {':id': {S: id}},
                ExclusiveStartKey: data.LastEvaluatedKey
            }, function (err, data) {
                loadMessages(err, data, id, messages, username, callback); //mostra as mensagens, ordenando pela mais recente
            });
        } else {
            loadConversationDetail(id, messages, username, callback); //ao entrar, acessa a conversa
        }
    } else {
        callback(err);
    }
}

function loadConversationDetail(id, messages, username, callback) {
    dynamo.query({
        TableName: 'Chat-Conversations', //a tabela das conversas
        Select: 'ALL_ATTRIBUTES',
        KeyConditionExpression: 'ConversationId = :id', //acessa a conversa pelo id
        ExpressionAttributeValues: {':id': {S: id}}
    }, function (err, data) { //essa é pra pegar todos os participantes da conversa
        if (err === null) {
            var participants = [];
            data.Items.forEach(function (item) { //pega quem está na conversa
                participants.push(item.Username.S);
            });
            if (!participants.includes(username)){ //se o participante que não está na conversa tenta acessar
                callback("unauthorized");
            }
            callback(null, {
                id: id,
                participants: participants,
                last: messages.length > 0 ? messages[messages.length-1].time : undefined, //pega a hora da última mensagem. -1 porque o contador começa em zero
                messages: messages
            });
        } else {
            callback(err);
        }
    });
}