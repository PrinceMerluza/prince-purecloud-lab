// -------------------- Models -------------------------
//status type class
function StatusType(id, name, children, isAParent){
	//lol. inefficient structure.
	var self = this
	self.id = ko.observable(id);
	self.name = ko.observable(name);
	self.children = ko.observableArray(children);
	self.isAParent = ko.observable(isAParent);
}

//Conversation class
function Conversation(id, participants, startTime, endTime){
	var self = this;
	self.id = ko.observable(id);
	self.participants = ko.observableArray(participants);
	self.startTime = ko.observable(startTime);
	self.endTime = ko.observable(endTime);
	self.queueId = ko.observable("");
	self.queueName = ko.observable("");
	self.ani = ko.observable("");
	
	self.getDuration = function(){
		var t_start = new Date(self.startTime()).getTime();
		var t_end = new Date(self.endTime()).getTime();
		var duration = t_end - t_start;
		return beautifyDuration(duration);
	}
}

//Participant class
function Participant(id, ani, purpose){
	this.id = ko.observable(id);
	this.name = ko.observable("");
	this.ani = ko.observable(ani);
	this.purpose = ko.observable(purpose);
}


var model;
function ViewModel(){
	model = this;
	
	model.arrStatus = ko.observableArray([]);
	model.arrConvos = ko.observableArray([]);
	model.isACallActive = ko.observable(false);
	
	model.numberToTransferTo = ko.observable("");
	model.numberToDial = ko.observable("");
	
	model.currentMuteState = ko.observable(false);
	model.currentHoldState = ko.observable(false);
	
	model.durationTimerValue = ko.observable(0); //not actual duration.
	
	//current convo 
	model.currentConvo = new Conversation("", [], "", "");
	/*model.currentConvo = {
		id: ko.observable("id"),
		participants: ko.observableArray([]),
		startTime: ko.observable("")
	}*/
	
	//current user singleton
	model.currentUser = {
		name: ko.observable('Loading'),
		id: ko.observable('user-id'),
		presence: ko.observable('null'),
		title: ko.observable('title'),
		department: ko.observable('dept'),
		returnAll: function(){
			return [model.currentUser.id(), model.currentUser.name(), 
					model.currentUser.presence(), model.currentUser.title(), 
					model.currentUser.department()];
		},
		nameOfPresence: function(){
			//get name of presence. very inefficient.
			var theName = null;
			model.arrStatus().forEach(function(item, index){
				if(model.currentUser.presence().localeCompare(item.id()) == 0){
					theName = item.name();
					return;
				}
				item.children().forEach(function(y_item, y_index){
					if(model.currentUser.presence().localeCompare(y_item.id()) == 0){
						theName = y_item.name();
						return;
					}
				});
				if(theName != null) return;
			});
			return theName;
			//model.currentUser.nameOfPresence(theName);
			//console.log(model.currentUser.nameOfPresence());
		}
	};
	
	
// --------------- METHODS ---------------------	
	//array of last 5 convos
	model.clearConvoHistory = function(){
		model.arrConvos([]);
	}
	
	//when a button is dialed using the phone numbers gui
	model.dtmfDial = function(dtmf, data){
		if(model.isACallActive()){
			model.numberToTransferTo(model.numberToTransferTo() + dtmf);
		}else{
			model.numberToDial(model.numberToDial() + dtmf);
		}
	}
	
	//API Call. Call Number
	model.callNumber = function(){
		var body = {
		  "phoneNumber": model.numberToDial()
		}
		conversationsApi.postCalls(body).then(function(result){
			console.log(result);
		}).catch(function(err){
			console.log(err);
		});
	}
	
	//API Call. Mute current convo
	model.muteCall = function() {
		var reqBody = {
			"muted": !model.currentMuteState()
		};
		model.currentMuteState(!model.currentMuteState());
		console.log("try to mute");
		console.log(model.currentConvo.id());
		console.log(model.currentConvo.participants());
		console.log(model.currentUser.id());
		console.log(reqBody);
		
		var participant_id;
		model.currentConvo.participants().forEach(function(item, index){
			if(item.name() == model.currentUser.name()){
				participant_id = item.id();
			}
		});
		
		conversationsApi.patchCallsCallIdParticipantsParticipantId(model.currentConvo.id(), participant_id, reqBody)
			.then(function(result) {
				console.log("Muted");
		}).catch(function(err){
				console.error(err);
		});
	}
	
	//API Call. Hold Current Convo
	model.holdCall = function(){
		var reqBody = {
			"held": !model.currentHoldState()
		};
		model.currentHoldState(!model.currentHoldState());
		
		var participant_id;
		model.currentConvo.participants().forEach(function(item, index){
			if(item.name() == model.currentUser.name()){
				participant_id = item.id();
			}
		});
		
		conversationsApi.patchCallsCallIdParticipantsParticipantId(model.currentConvo.id(), participant_id, reqBody).then(function(result) {
			console.log("HOLD!");
		}).catch(function(err){
			console.error(err);
		});
	}
	
	//API Call. Disconnect Current Convo.
	model.disconnectCall = function(){
		var reqBody = {
			"state": "disconnected"
		};
		
		var participant_id;
		model.currentConvo.participants().forEach(function(item, index){
			if(item.name() == model.currentUser.name()){
				participant_id = item.id();
			}
		});
		
		conversationsApi.patchCallsCallIdParticipantsParticipantId(model.currentConvo.id(), participant_id, reqBody).then(function(result) {
			console.log("Disconnected");
		}).catch(function(err){
			console.error(err);
		});
	}

	//API Call. Blind Transfer.
	model.blindTransfer = function(){
		var callId = model.currentConvo.id();

		var participantId = model.currentConvo.participants()[model.currentConvo.participants().length - 1].id();
		var reqBody = {
			"speakTo": "destination",
			"destination":{
				"address" : model.numberToTransferTo()
			}
		};
		conversationsApi.postCallsCallIdParticipantsParticipantIdConsult(callId, participantId, reqBody).then(function(result) {
			console.log("blind transferred");
			model.disconnectCall();
		}).catch(function(err){
			console.error(err);
		});
	}
	
	//API Call. Consult Transfer.
	model.consultTransfer = function(){
		var callId = model.currentConvo.id();

		var participantId = model.currentConvo.participants()[model.currentConvo.participants().length - 1].id();
		var reqBody = {
			"speakTo": "destination",
			"destination":{
				"address" : model.numberToTransferTo()
			}
		};
		conversationsApi.postCallsCallIdParticipantsParticipantIdConsult(callId, participantId, reqBody).then(function(result) {
			console.log("consult transferred");
		}).catch(function(err){
			console.error(err);
		});
	}

	//API Call. Change Presence.
	model.changePresence = function(newPresence){
		var body = 	{
			  "name": "",
			  "source": "",
			  "primary": true,
			  "presenceDefinition": {
				"id": newPresence.id(),
				"systemPresence": ""
			  },
			  "message": "",
			  "modifiedDate": ""
			}
			
		presenceApi.patchUserIdPresencesSourceId(model.currentUser.id(), "PURECLOUD", body)
			.then(function(result){
				console.log(result);
				model.currentUser.presence(result.presenceDefinition.id);
			})
			.catch(function(error){
				console.log(error);
			});
	}
}
