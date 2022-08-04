var ChatApp = window.ChatApp || {};

(function scopeWrapper($) {

    var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData); //cria a pool table do cognito

    var token = null;

    var lastChat = null; //pra pegar o momento da ultima mensagem

    var apiClient = apigClientFactory.newClient();
    //essa função não usa callback, está usando os dados salvos no próprio browser
    ChatApp.checkLogin = function (redirectOnRec, redirectOnUnrec) { //verifica se o usuário está logado e redireciona 
        var cognitoUser = userPool.getCurrentUser(); //verifica no userpool o usuário atual
        if (cognitoUser !== null) {
            if (redirectOnRec) {
                window.location = '/chats.html'; //se tá logado manda pra chats page
            }
        } else {
            if (redirectOnUnrec) {
                window.location = '/'; //se não manda pra signup
            }
        }
    }; //essa é pra se a pessoa tentar entrar em alguma página direto, e não tiver logado, ele já manda pra pag de fazer o signup

    ChatApp.login = function () { //função de login
        var username = $('#username').val(); //passa usuário e senha como parâmtro
        var authenticationData = {
            Username: username,
            Password: $('#password').val()
        };
        //cria uma autenticação para entrar no login api
        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        var userData = {
            Username: username,
            Pool: userPool
        };
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData); //cria um cognito user para passar os dados do usuário
        cognitoUser.authenticateUser(authenticationDetails, { //para confirmar o usuário
            onSuccess: function () {
                window.location = '/chats.html'; //com sucesso manda pro chats
            },
            onFailure: function (err) { //com falha da um alerta
                alert(err);
            }
        });
    };

    ChatApp.logout = function () { //função de logout
        var cognitoUser = userPool.getCurrentUser(); //pega o usuário atual, que está ativo
        cognitoUser.signOut(); //desloga ele pelo cognito
        window.location = '/'; //manda de volta pra página de login/homepage
    };

    ChatApp.populateChats = function () {
        ChatApp.useToken(function (token) { //seria o token do login
            apiClient.conversationsGet({}, null, {headers: {Authorization: token}}) //agora a função tem o header authorization e passa os parametros
                .then(function (result) { //o token é gerado quando verifica o usuário logado e só mostra o que relacionei com ele
                    var currentUsername = userPool.getCurrentUser().getUsername();

                    result.data.forEach(function (convo) {
                        var otherUsers = [];
                        convo.participants.forEach(function (user) { //vai em cada participante, se não é o usuário, coloca no final da lista
                            if (user !== currentUsername) {
                                otherUsers.push(user);
                            }
                        });

                        var last = '&nbsp;'; //pega a ultima conversa
                        if (convo.last) {
                            last = moment(new Date(convo.last)).fromNow(); //usa a função moment pra converter em hora
                        }
                        //coloca uma tabela no chat html - lista de usuários que entrarem
                        $('TBODY').append('<tr><td><a href="chat.html#' + convo.id + '">' + otherUsers.join(', ') + '</a></td><td>' + last + '</td></tr>');
                    }); //# é uma ancora, não atualiza a página, só atualiza a informação
                    $('TBODY').append('<tr><td></td><td></td></tr>');
                });
        });
    };

    ChatApp.loadChat = function () {
        var currentUsername = userPool.getCurrentUser().getUsername();
        ChatApp.useToken(function (token) {
            apiClient.conversationsIdGet({id: location.hash.substring(1)}, null, {headers: {Authorization: token}}) //pega o parametro passado pela ancora e o token
                .then(function (result) {
                    var lastRendered = lastChat === null ? 0 : lastChat; //criar a variavel da ultima mensagem carregada
                    if((lastChat === null && result.data.last) || lastChat < result.data.last) { //verifica quando foi a ultima mensagem
                        lastChat = result.data.last; //se o horário não mudou, não tem mensagem nova
                    } else {
                        return;
                    }
                    result.data.messages.forEach(function (message) { //se mudou, tem ao menos uma nova mensagem
                        if(message.time > lastRendered) {
                            var panel = $('<div class="panel">');
                            if (message.sender === currentUsername) {
                                panel.addClass('panel-default');
                            } else {
                                panel.addClass('panel-info');
                                panel.append('<div class="panel-heading">' + message.sender + '</div>');
                            }
                            var body = $('<div class="panel-body">').text(message.message); //configurando as duas colunas, onde suas mensagens vão para um lado e a dos outros pro outro
                            panel.append(body);
                            panel.append('<div class="panel-footer messageTime" data-time="' + message.time + '">' + moment(message.time).fromNow() + '</div>'); 
                            //colocando a hora da mensagem com o moment
                            var row = $('<div class="row">');
                            var buffer = $('<div class="col-xs-4">');
                            var holder = $('<div class="col-xs-8">');
                            holder.append(panel);

                            if (message.sender === currentUsername) {
                                row.append(buffer);
                                row.append(holder);
                            } else {
                                row.append(holder);
                                row.append(buffer);
                            }

                            $('#chat').append(row);
                        }
                    });
                    window.scrollTo(0, document.body.scrollHeight); //rolagem automática
                });
        });
    };

    ChatApp.send = function () {
        // Supondo que o token será gerado agora
        ChatApp.useToken(function(token) {
            apiClient.conversationsIdPost({id: location.hash.substring(1)}, $('#message').val(), {headers: {Authorization: token}}) //envia a mensagem por um post
                .then(function () { //para enviar a mensagem pelo conversations POST
                    $('#message').val('').focus();
                    ChatApp.loadChat();
                });
        });
    };

    ChatApp.populatePeople = function () { //função para iniciar um novo chat
        ChatApp.useToken(function (token) {
            apiClient.usersGet({}, null, {headers: {Authorization: token}}) //sempre verificando o usuário logado
            //Não precisa dos parametros do url, não tem body ou get requests então passa null, não tem header ou model param então vazio tbm
                .then(function (result) {
                    result.data.forEach(function (name) {
                        var button = $('<button class="btn btn-primary">Começar conversa</button>'); 
                        //o resultado da api é um array com uma lista de nomes que são os usuários
                        button.on('click', function() {
                            ChatApp.startChat(name); //cria o botão e lista as pessoas para começar a conversa
                        });

                        var row = $('<tr>');
                        row.append('<td>' + name + '</td>');
                        var cell = $('<td>');
                        cell.append(button); //botão pra criar um novo chat
                        row.append(cell);
                        $('TBODY').append(row); //cria o table row com os usuários do app e os lista para criar uma nova ocnversa
                    });
                    $('TBODY').append('<tr><td></td><td></td></tr>');
                });
        });
    };

    ChatApp.startChat = function (name) {
        // O token será definido agora
        apiClient.conversationsPost({}, [name], {headers: {Authorization: token}})
            .then(function (result) {
                window.location = '/chat.html#' + result.data;
            });
    };

    ChatApp.signup = function () { //função de registro
        var username = $('#username').val(); //passa usuário e senha como parâmetro
        var password = $('#password').val();
        var email = new AmazonCognitoIdentity.CognitoUserAttribute({ //cria um novo usuário no cognito
            Name: 'email',
            Value: $('#email').val()
        });

        userPool.signUp(username, password, [email], null, function (err, result) { //o null é a validação que gera o token, callback do erro é um alerta na tela
            if (err) {
                alert(err);
            } else {
                window.location = '/confirm.html#' + username; //manda pra página de confirmação com o nome do usuário
            }
        });
    };

    ChatApp.confirm = function () { //função de confirmar
        var username = location.hash.substring(1); //pega o nome de usuário na url
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser({ //cria o cognito user por uma tuple
            Username: username,
            Pool: userPool
        });
        //pra confirmar o registro a função pega 3 argumentos, o código do formulário, se o alias tem que ser atualizado ou não - pra não repetir ou duplicar, por último o callback
        cognitoUser.confirmRegistration($('#code').val(), true, function (err, results) {
            if (err) {
                alert(err); //alerta se tem problema
            } else {
                window.location = '/'; //se deu certo só redireciona pra homepage
            }
        });
    };

    ChatApp.resend = function () { //se não recebeu o código ou deu erro, reenvia a validação
        var username = location.hash.substring(1); //verifica o usuário pela url
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser({ //cria o cognito user de novo, meio que reestarta a função anterior
            Username: username,
            Pool: userPool
        });
        cognitoUser.resendConfirmationCode(function (err) {
            if (err) {
                alert(err); //se der erro só mostra um alerta
            }
        })
    };

    ChatApp.useToken = function (callback) {
        if (token === null) {
            var cognitoUser = userPool.getCurrentUser(); //cria uma var do cognitouser atual
            if (cognitoUser !== null) { //se o usuário está logado
                cognitoUser.getSession(function (err, session) { //pega a sessão do usuário logado
                    if (err) {
                        window.location = '/';
                    }
                    token = session.getIdToken().getJwtToken();
                    callback(token);
                });
            }
        } else {
            callback(token);
        }
    };

}(jQuery));