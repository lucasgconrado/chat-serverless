'use strict';

var AWS = require('aws-sdk');

var cognito = new AWS.CognitoIdentityServiceProvider(); //cria um cliente cognito

exports.handler = function (event, context, callback) { //chama uma lista de usuários que estão nele
    cognito.listUsers({ //usa 4 parametros
        UserPoolId: 'us-east-1_GbLmKa6Ay', //id da pool do cognito
        AttributesToGet: [], //quais atributos pegar
        Filter: '', //filtrar os resultados
        Limit: 60 //resultados pra retornar
    }, function (err, data) {
        if (err === null) { //pega os erros
            var logins = [];
            data.Users.forEach(function (user) { //pega os username
                if (event.cognitoUsername !== user.Username){ //pra não mostrar a opção de conversa com o usuário atual
                    logins.push(user.Username); //coloca no array pra fazer o return
                } 
            });
            callback(null, logins);
        } else {
            callback(err);
        }
    });
};