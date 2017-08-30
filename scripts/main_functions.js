
function noop(){$.LoadingOverlay("hide");}; //for blank callback

function buildAtStart(){
	getMe(getPresenceDefinitions);
}

//get current user details
function getMe(callback){
	var expand = ["presence"];

	usersApi.getMe(expand)
		.then(function(result){
			//fill the view model with details
			model.currentUser.name(result.name);
			model.currentUser.id(result.id);
			model.currentUser.presence(result.presence.presenceDefinition.id);
			model.currentUser.title(result.title);
			
			console.log(model.currentUser.returnAll());
			
			//get call history next
			callback(subscribeToNotifs);
	})
		.catch(function(error){
			setTimeout(getMe(callback), timeoutRetryTime);
			console.log(error);
	});
}

//get org's presences and structure it.
function getPresenceDefinitions(callback){
	var pageNumber = 1;
	var pageSize = 100;

	presenceApi.getPresencedefinitions(pageNumber, pageSize, "", "").then(function(data){
  
		for(var i = 0; i < data.total; i++){
			//collect secondary statuses with same parent status
			var children = [];
			for(var j = 0; j < data.total; j++){
				if((data.entities[j].systemPresence == data.entities[i].languageLabels.en_US) && 
				   (data.entities[j].systemPresence != data.entities[j].languageLabels.en_US)){
					children.push(new StatusType(
						data.entities[j].id,
						data.entities[j].languageLabels.en_US,
						null
					));
						
				} 
			}
			
			//add parent statuses
			if(data.entities[i].systemPresence == data.entities[i].languageLabels.en_US){
				model.arrStatus.push(new StatusType(
					data.entities[i].id,
					data.entities[i].languageLabels.en_US,
					children,
					children.length > 0 ? true: false
				));
				children = [];
			}
		}

		//show all status
		console.log(model.arrStatus());
					
		callback(getCallHistory);
	})
	  .catch(function(error){
		setTimeout(getPresenceDefinitions(callback), timeoutRetryTime);;
		console.log(error);
	});
}

//get the history and the current conversation
function getCallHistory(callback){
	var pageSize = callHistoryToShow;
	var pageNumber = 1;
	
	conversationsApi.getCallsHistory(pageSize, pageNumber).then(function(x_result){
		console.log(x_result);
		model.clearConvoHistory(); //clear convo history of course
		
		//loop through the conversations and add them to the arrConvos
		x_result.entities.forEach(function(x_item, x_index){	
			model.arrConvos.push(new Conversation(x_item.id, [], "", ""));
		
			//make api call for more detailed convo information.
			conversationsApi.getConversationId(model.arrConvos()[x_index].id()).then(function(y_result){
				
				model.arrConvos()[x_index].participants([]); //make sure participant array is blank
				
				//loop through the participants and add to the proper convo in arrConvos
				y_result.participants.forEach(function(item, index){
					model.arrConvos()[x_index].participants.push(new Participant(item.id, item.ani, item.purpose));	
					model.arrConvos()[x_index].participants()[index].name(item.name);

					//get the duration which is relative to startTimme and endTime of user participant
					if(((item.purpose == "user") || (item.purpose == "agent")) && (item.userId == model.currentUser.id())){
						model.arrConvos()[x_index].startTime(item.startTime? item.startTime : "");
						model.arrConvos()[x_index].endTime(item.endTime? item.endTime : "");
					} 
					
					if(item.purpose == "acd"){
						model.arrConvos()[x_index].queueName(item.name ? item.name : "");
					}
				});
				
				model.arrConvos()[x_index].queueId(y_result.participants[0].queueId ? y_result.participants[0].queueId : "");
				model.arrConvos()[x_index].ani(y_result.participants[0].dnis ? y_result.participants[0].dnis : "");
				
				//check if a call is active
				x_item.participants.forEach(function(c_item, c_index){
					if((c_item.user) && (!c_item.endTime) && (c_item.user.id == model.currentUser.id())){
						//dirty setting of currentConvoValues. Ugly af :(
						console.log("CONVO ONGOING!");
						model.isACallActive(true);
						model.currentConvo.id(model.arrConvos()[x_index].id())
						model.currentConvo.participants(model.arrConvos()[x_index].participants());
						model.currentConvo.startTime(model.arrConvos()[x_index].startTime());
						model.currentConvo.endTime(model.arrConvos()[x_index].endTime());
						model.currentConvo.queueId(model.arrConvos()[x_index].queueId());
						model.currentConvo.queueName(model.arrConvos()[x_index].queueName());
						model.currentConvo.ani(model.arrConvos()[x_index].ani());
					}
				});
			}).catch(function(err){
				console.log(err);
			});

		});
		
		console.log(model.arrConvos());
		callback();
	}).catch(function(err){
		console.log(err);
		setTimeout(getCallHistory(callback), timeoutRetryTime);	
	});
}

//set up notifciation for presence and conversation
function subscribeToNotifs(callback){
	notificationsApi.postChannels()
		.then(function(data){
			console.log("Websocket Uri: " + data.connectUri);
			webSocket = new WebSocket(data.connectUri);
			
			webSocket.onopen = function(){	
				userPresenceTopic = 'v2.users.' + model.currentUser.id() + '.presence';
                conversationsTopic = 'v2.users.' + model.currentUser.id() + '.conversations';
				
				notificationsApi.postChannelsChannelIdSubscriptions(data.id, [
					{
						"id": userPresenceTopic
					},
					{
						"id": conversationsTopic
					}]).then(function(result){
						console.log(result)
					}).catch(function(err){
						console.log(err);
					});
			};

			webSocket.onmessage = function(message) {
				var data = JSON.parse(message.data);
					
				if (data.topicName == userPresenceTopic){
					getMe(noop);
				}else if(data.topicName == conversationsTopic) {
					console.log("CALL ALERT!");
					console.log(data);
					if(data.eventBody.participants[0].endTime){
						//a call just ended
						model.isACallActive(false);
						getCallHistory(noop);
						model.durationTimerValue(0);
						endTimer();
						
					}else{
						//a call just started
						if(!model.isACallActive()){startTimer(); console.log("asdas");}
						model.isACallActive(true);
						
						var t_arrParticipants = [];
						var t_participant;
						data.eventBody.participants.forEach(function(item, index){
							t_participant = new Participant(item.id, item.ani, item.purpose);
							if((item.purpose == 'user') || (item.purpose == 'agent')){
								t_participant.name(item.userId);
							}else{
								t_participant.name(item.name);
							}	
							
							t_arrParticipants.push(t_participant);
							
							//update values if call has an acd participant
							if(item.purpose == "acd"){
								model.currentConvo.queueId(item.queueId);
								model.currentConvo.queueName(item.name);	
							}
						});
						updateCurrentConvo(data.eventBody.id, t_arrParticipants);
					}
				}else if(data.topicName == 'channel.metadata') {
					console.log('thump... THUMP...');
				}else{
					console.warn('Unexpected topic: ' + data.topicName)
					console.debug(data);
				}
			};
			
			callback(noop);
		}).catch(function(err){
			
			setTimeout(subscribeToNotifs(callback), timeoutRetryTime);
			console.log(err);
		});
}

//update current conversation details
function updateCurrentConvo(id, participants){
	var today = new Date().toISOString();

	model.currentConvo.id(id);
	model.currentConvo.participants(participants);
	model.currentConvo.startTime(today);
	
	model.currentConvo.participants().forEach(function(item, index){
		if((item.purpose() == 'user') || (item.purpose() == 'agent')){
			var t_uid = item.name();
			usersApi.getUserId(t_uid, []).then(function(result){
				item.name(result.name);
			}).catch(function(err){
				console.log(err);
			});
		}
	});
}

//start timer
function startTimer(){
	clearInterval(timerHandler);
	timerHandler = setInterval(everySecond,1000);
}

//every second
function everySecond(){
	model.durationTimerValue(model.durationTimerValue() + 1);
}

//end timer
function endTimer(){
	clearInterval(timerHandler);
}
