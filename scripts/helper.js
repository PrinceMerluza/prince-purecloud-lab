

function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\#&]" + name + "=([^&#]*)"),
	  results = regex.exec(location.hash);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function showMe(array){
	var list = document.createElement('ul');
	for (var i = 0; i <array.length; i++){
		var item = document.createElement('li');
		item.appendChild(document.createTextNode(array[i]));
		list.appendChild(item);
	}
	return list;
}

function beautifyDuration(ms){
	var res = "";
	
	ms = Math.round(ms/1000);
	var hours = Math.floor(ms / (60 * 60));
	var minutes = Math.floor((ms / 60) % 60);
	var seconds = ms % 60;
	if(hours > 0) res += hours + "h, ";
	if(minutes > 0) res += minutes + "m, ";
	res += seconds + "s.";
	
	return res;
}