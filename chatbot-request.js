var _ = require('underscore');
var ChatContext = require('./lib/chat-context.js');
var moment = require('moment');
var MessageTemplate = require('./lib/message-template.js');

module.exports = function(RED) {

  function ChatBotRequest(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    this.message = config.message;
    this.buttonLabel = config.buttonLabel;
    this.requestType = config.requestType;

    // relay message
    var handler = function(msg) {
      node.send([null, msg]);
    };
    RED.events.on('node:' + config.id, handler);

    this.on('input', function(msg) {

      var context = node.context();
      var originalMessage = msg.originalMessage;
      var chatId = msg.payload.chatId || (originalMessage && originalMessage.chat.id);
      var messageId = msg.payload.messageId || (originalMessage && originalMessage.message_id);
      var message = node.message;
      var requestType = node.requestType;
      var buttonLabel = node.buttonLabel;
      var chatContext = context.flow.get('chat:' + chatId) || ChatContext(chatId);
      var template = MessageTemplate(msg, node);

      // check if this node has some wirings in the follow up pin, in that case
      // the next message should be redirected here
      if (!_.isEmpty(node.wires[1])) {
        chatContext.set('currentConversationNode', node.id);
        chatContext.set('currentConversationNode_at', moment());
      }

      var keyboard = null;
      if (requestType === 'location') {
        keyboard = [
          [{
            text: !_.isEmpty(buttonLabel) ? buttonLabel : 'Send your position',
            request_location: true
          }]
        ];
      } else if (requestType === 'phone-number') {
        keyboard = [
          [{
            text: !_.isEmpty(buttonLabel) ? buttonLabel : 'Send your phone number',
            request_contact: true
          }]
        ];
      }

      // send out the message
      // todo move this format to telegram sender
      msg.payload = {
        type: 'message',
        content: template(message),
        chatId: chatId,
        messageId: messageId,
        options: {
          reply_markup: JSON.stringify({
            keyboard: keyboard,
            'resize_keyboard': true,
            'one_time_keyboard': true
          })
        }
      };

      node.send([msg, null]);
    });

    // cleanup on close
    this.on('close',function() {
      RED.events.removeListener('node:' + config.id, handler);
    });
  }

  RED.nodes.registerType('chatbot-request', ChatBotRequest);

};
