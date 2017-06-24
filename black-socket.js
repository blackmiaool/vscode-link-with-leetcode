const WebSocket = require("ws");

function createSocketIo(wsserver) {
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
                        cb = (data) => {
                            this.sendCb(uid, data);
                        }
                    }
                    this.eventListenerMap[event].forEach(function (listener) {
                        listener(data, cb);
                    });
                } else if (type === "cb") {
                    this.cbMap[uid] && this.cbMap[uid](data);
                    delete this.cbMap[uid];
                }
            });
            if (this.isClient && this.type) {
                ws.addEventListener("open", () => {
                    this.emit("setType", this.type);
                });
            }
            if (!this.isClient) { //life line
                this.lifeInterval = setInterval(() => {
                    if (ws.readyState == WebSocket.OPEN) {
                        ws.send(Math.floor(Math.random() * 1000) + "");
                    }
                }, 25000);
            }
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
        on(event, cb) {
            if (event === "open" || event === "close") {
                this.ws.addEventListener(event, cb);
            } else {
                if (!this.eventListenerMap[event]) {
                    this.eventListenerMap[event] = [];
                }
                this.eventListenerMap[event].push(cb);
            }

        }
    }
  
    function on(event, cb) {
        return wsserver.on(event, function (ws) {
            const socket = new Socket({
                type: "server",
                isClient: false
            });
            socket.init(ws);
            cb(socket);
        });
    }
    return {
        on
    }
};
module.exports = {
    createSocketIo
}