'use strict';
//uuid unique identifier
const { v4: uuidV4 } = require('uuid');

var AWS = require('aws-sdk');

var dynamo = new AWS.DynamoDB();

exports.handler = function (event, context, callback) {
    var id = uuidV4();
    var users = event.users; //todos os usuários em um único array
    users.push(event.cognitoUsername);
    var records = [];
    users.forEach(function(user) {
        records.push({
            PutRequest: { //a hash key é o conversationId, sort key é o usuário, então tem que salvar cada usuário na conversa
                Item: { //ele pega em pares, o conversation e o username
                    ConversationId: {
                        S: id
                    },
                    Username: {
                        S: user
                    }
                }
            }
        });
    });

    dynamo.batchWriteItem({ //salva tudo no mesmo array
        RequestItems: { //não tem parametro da tabela, porque a key e o valor já estão no request
            'Chat-Conversations': records
        }
    }, function (err, data) {
        if(err === null) {
            callback(null, id);
        } else {
            callback(err);
        }
    });
};