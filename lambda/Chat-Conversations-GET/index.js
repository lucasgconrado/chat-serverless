'use strict';

var AWS = require('aws-sdk');

var dynamo = new AWS.DynamoDB(); //cliente dynamo

exports.handler = function (event, context, callback) {
    dynamo.query({
        TableName: 'Chat-Conversations', //acessa a tabela
        IndexName: 'Username-ConversationId-index', //o index criado na tabela para usar o id da conversa
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        KeyConditionExpression: 'Username = :username', //a chave será o id do usuario
        ExpressionAttributeValues: {':username': {S: event.cognitoUsername}}
    }, function (err, data) {
        handleIdQuery(err, data, callback, [], event.cognitoUsername);
    });
};

function handleIdQuery(err, data, callback, ids, username) {
    console.log("Username query results: " + JSON.stringify(data));
    if (err === null) {
        data.Items.forEach(function (item) { //cria um loop pra carregar as conversas
            ids.push(item.ConversationId.S);
        });

        if (data.LastEvaluatedKey) {
            dynamo.query({
                TableName: 'Chat-Conversations',
                IndexName: 'Username-ConversationId-index',
                Select: 'ALL_PROJECTED_ATTRIBUTES',
                KeyConditionExpression: 'Username = :username',
                ExpressionAttributeValues: {':username': {S: username}},
                ExclusiveStartKey: data.LastEvaluatedKey
            }, function (err, data) {
                handleIdQuery(err, data, callback, ids, username);
            });
        } else {
            loadDetails(ids, callback);
        }
    } else {
        callback(err);
    }
}

function finished(convos) { //verifica se tem participantes, se não a conversa terminou
    for (var i = 0; i < convos.length; i++) {
        if (!convos[i].participants) {
            return false;
        }
    }
    return true;
}

function loadDetails(ids, callback) { //cria um array com todas as conversas
    console.log("Loading details");
    var convos = [];
    ids.forEach(function (id) {
        var convo = {id: id};
        convos.push(convo);
    });

    if(convos.length > 0) { //carrega os dados da conversa se existirem
        convos.forEach(function (convo) {
            loadConvoLast(convo, convos, callback);
        });
    } else {
        callback(null, convos);
    }
}

function loadConvoLast(convo, convos, callback) { //encontra a última mensagem para definiri o horário da conversa
    dynamo.query({
        TableName: 'Chat-Messages',
        ProjectionExpression: '#T',
        Limit: 1, //só vai procurar por uma mensagem, que é a ultima
        ScanIndexForward: false, //false para escanear ao contrário e puxar a última
        KeyConditionExpression: 'ConversationId = :id',
        ExpressionAttributeNames: {'#T': 'Timestamp'},
        ExpressionAttributeValues: {':id': {S: convo.id}}
    }, function (err, data) {
        if (err === null) {
            if (data.Items.length === 1) {
                convo.last = Number(data.Items[0].Timestamp.N); //se tiver resultado, pega o horário e coloca na conversa
            }
            loadConvoParticipants(convo, convos, callback);
        } else {
            callback(err);
        }
    });
}

function loadConvoParticipants(convo, convos, callback) {
    dynamo.query({
        TableName: 'Chat-Conversations',
        Select: 'ALL_ATTRIBUTES',
        KeyConditionExpression: 'ConversationId = :id',
        ExpressionAttributeValues: {':id': {S: convo.id}}
    }, function (err, data) {
        if (err === null) {
            var participants = [];
            data.Items.forEach(function (item) {
                participants.push(item.Username.S); //cria um array com os participantes, se existirem
            });
            convo.participants = participants;

            if (finished(convos)) { //puxa a função pra ver se tem participantes, se não tiver, encerra
                callback(null, convos);
            }
        } else {
            callback(err);
        }
    });
}