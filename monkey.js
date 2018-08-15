// ==UserScript==
// @name         leetcode-editor
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  try to take over the world!
// @author       You
// @match        https://leetcode.com/*
// @grant        none
// ==/UserScript==
class Socket {
    init(ws) {
        this.ws = ws;
        if (this.isClient) {
            ws.addEventListener('open', () => {

            });
        }
        ws.addEventListener("message", (message) => {
            if (!message.data || message.data.match(/^\d+$/)) {
                return;
            }

            let {
                uid,
                needCb,
                data,
                event,
                type
            } = JSON.parse(message.data);
            if (type === "msg") {
                if (!this.eventListenerMap[event]) {
                    return;
                }
                let cb;
                if (needCb) {
                    cb = (data) => this.sendCb(uid, data);

                }
                this.eventListenerMap[event].forEach(function ({listener}) {
                    listener(data, cb);
                });
                this.clearListenrMap(event);

            } else if (type === "cb") {
                this.cbMap[uid] && this.cbMap[uid](data);
                delete this.cbMap[uid];
            }
        });
        if (this.isClient && this.type) {
            ws.addEventListener("open", (event) => {
                this.emit("setType", this.type);
                let onceArr=[];
                this.eventListenerMap["open"]&&this.eventListenerMap["open"].forEach(({listener})=>listener(event));
                this.clearListenrMap("open");
            });
            ws.addEventListener("close", () => {
                this.eventListenerMap["close"]&&this.eventListenerMap["close"].forEach(({listener})=>listener(event));
                this.clearListenrMap("close");
            });

        }
        if (!this.isClient) { //life line
            this.lifeInterval = setInterval(() => {
                if (ws.readyState == WebSocket.OPEN) {
                    ws.send(Math.floor(Math.random() * 1000) + "");
                }
            }, 5000);
        }
    }
    clearListenrMap(eventName){
        if(!this.eventListenerMap[eventName]){
            return;
        }
        const arr=[];
        this.eventListenerMap[eventName].forEach(function({once},i){
            if(once){
                arr.push(i);
            }
        });
        arr.forEach((index,i)=>{
            this.eventListenerMap[eventName].splice(index-i,1);
        });
    }
    constructor({
        type,
        isClient
    } = {}) {

        this.type = type;
        this.isClient = isClient;
        this.uid = 1;
        this.eventListenerMap = {};
        this.cbMap = {};
    }
    close() {
        this.ws.close();
    }
    emit(event, data, cb) {
        const msg = {};
        msg.uid = this.uid;
        this.uid++;
        if (cb) {
            msg.needCb = true;
            this.cbMap[msg.uid] = cb;
        }
        msg.data = data;
        msg.event = event;
        msg.type = "msg";
        try {
            this.ws.send(JSON.stringify(msg));
        } catch (e) {

        }
    }
    sendCb(uid, data) {
        this.ws.send(JSON.stringify({
            type: "cb",
            uid,
            data
        }));
    }
    on(event, listener) {
        if (!this.eventListenerMap[event]) {
            this.eventListenerMap[event] = [];
        }
        this.eventListenerMap[event].push({listener});
    }
    once(event,listener){
        if (!this.eventListenerMap[event]) {
            this.eventListenerMap[event] = [];
        }
        this.eventListenerMap[event].push({listener,once:true});
    }
};
function getSocket(addr, type) {
    let ws;
    //auto connect
    let checkInterval;

    function connect(addr) {
        if (socket.ws) {
            socket.ws.close();
        }
        ws = new WebSocket(addr);
        ws.addEventListener("close", function (event) {
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            checkInterval = setInterval(function () {
                connect(addr);
            }, 5000);
        });

        ws.addEventListener("open", function (event) {
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = 0;
            }

        });
        socket.init(ws);
    }


    const socket = new Socket({
        type,
        isClient: true
    });
    connect(addr);
    return socket;
}
const langMap={
    python3:'python',
    golang:'go'
}

!(function() {
    'use strict';

    const interval=setInterval(function(){
        if(typeof $==='undefined')
            return;
        const $editor=$(".ReactCodeMirror");
        const $bar=$(".control-btn-bar,.toolbar-base");
        const $$=$bar.find.bind($bar);
        if(!$editor.length||!$bar.length){
            return;
        }
        let remoteCode;
        clearInterval(interval);
        let socket;
        const $btn=$(`<button class='btn btn-default' style='margin-left:12px;'>VS Code<span class="vscode-connection" style="width:10px;height:10px;margin-left:7px;display:inline-block;border-radius:100px;background-color:grey;"></span></button>`);
        $bar.find(".pull-right").last().prepend($btn);
        const editor=$(".CodeMirror").first()[0].CodeMirror;
        let socketEditing=false;
        let preventSocketEditing=false;
        function initSocket(){
            socket=getSocket("ws://localhost:28374","browser");
            socket.on("change",function(value){
                if(editor.getValue()===value){
                    return ;
                }
                remoteCode=value;
                if(document.visibilityState==='hidden'){
                    return;
                }
                if(preventSocketEditing){
                    return ;
                }

                socketEditing=true;
                editor.setValue(value,1);
                editor.replaceRange(value[0],{line:0,ch:0},{line:0,ch:1})
                socketEditing=false;
            });
            socket.on("open",function(){
                enable(true);
            });
            socket.on("close",function(){
                disable();
            });
        }
        document.addEventListener("visibilitychange", function() {
            if(!socket){
                return;
            }
            if(document.visibilityState==='hidden'){
                return;
            }

            onChange();
        });
        function onChange(){
            if(!socket){
                return;
            }
            const code=editor.getValue();
            if(!code){
                return;
            }
            if(code===remoteCode){
                return;
            }
            socket.emit("change",{content:code});
        }
        editor.on('change', function(e,t,b) {
            if(!socketEditing){
                if(preventSocketEditing){
                    clearTimeout(preventSocketEditing);
                }
                preventSocketEditing=setTimeout(()=>{
                    preventSocketEditing=0;
                },200);
            }
            setTimeout(onChange);

        });
        function onClick(){
            if(!socket){
                initSocket();
                socket.once('open',onClick);
                return;
            }
            let language=$$("[name='lang-select']").val()||$$("#langMenu").text().toLowerCase().trim();
            if(langMap[language]){
                language=langMap[language];
            }
            const code=editor.getValue();
            remoteCode=code;
            socket.emit("create",{language,content:remoteCode,description:$(".question-description").text().trim()});
        }
        $btn.click(onClick);
        function enable(green){
            if(green){
                $btn.find(".vscode-connection").css("background-color","#5cb85c");
            }
            $btn.removeAttr("title").removeAttr("disabled");
        }
        function disable(){
            $btn.attr("disabled","").attr("title","disconnected").find(".vscode-connection").css("background-color","gray");
        }
        enable(false);

    },100);

})();