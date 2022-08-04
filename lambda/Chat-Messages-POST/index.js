'use strict';

var AWS = require('aws-sdk');

var dynamo = new AWS.DynamoDB(); //cria o cliente dynamo

exports.handler = function (event, context, callback) {
    dynamo.putItem({
        TableName: 'Chat-Messages', //tabela das mensagens do chat
        Item: {
            ConversationId: {S: event.id},
            Timestamp: {
                N: "" + new Date().getTime() //colocar a hora que a mensagem foi enviada
            },
            Message: {S: event.message},
            Sender: {S: event.cognitoUsername} //Quem enviou ele pega pelo nome de usuário do cognito
        }
    }, callback);
};