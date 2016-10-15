const SerialPort = require('serialport');

var comPorts, serial, inputDeviceInfos; //serial stuff
var audioStream, audioCtx, analyser, source; //audio stuff
var sCanvas, wCanvas, sAnimation, wAnimation, sCtx, wCtx; //animation stuff

window.onload = () => {
	scanPorts();
	scanAudioInputs();
};

function scanPorts(){
	document.getElementById('connect').disabled = true;
	document.getElementById('connect').innerHTML = 'Connect';
	document.getElementById('scan').disabled = false;
	document.getElementById('serialSelect').disabled = false;
	SerialPort.list((err, ports) => {
		if(err){
			console.log(err);
		}else{
			let list = [];
			if(ports.length){
				for(let item of ports){
					list.push(item.comName);
				}
			}
			comPorts = list;
			updatePortsSelect(comPorts);
		}
	});
};

function updatePortsSelect(list){ //takes an array of comNames
	let inner = '';
	for(var item of list){
		inner += '<option value="' + item + '">' + item + '</option>\n';
	}
	document.getElementById('serialSelect').innerHTML = inner;
	if(list.length){
		document.getElementById('connect').disabled = false;
	}
};

function connectSerial(){
	if(serial && serial.isOpen()){
		disconnectSerial();
		return;
	}
	let s = document.getElementById('serialSelect');
	serial = new SerialPort(s.options[s.selectedIndex].value, {
		baudRate: 115200
	});
	setupSerial();
	s.disabled = true;
	document.getElementById('connect').disabled = true;
	document.getElementById('connect').innerHTML = 'Connecting...';
	document.getElementById('scan').disabled = true;
};

function setupSerial(){
	serial.on('open', () => {
		console.log('serial opened');
		document.getElementById('connect').disabled = false;
		document.getElementById('connect').innerHTML = 'Disconnect';
	});

	serial.on('error', (e) => {
		if(serial.isOpen()){
			serial.close((e) => {
				console.log('error: ' + e);
			});
		}
	});

	serial.on('disconnect', (e) => {
		console.log('serial disconnected');
		if(e) console.log(e);
	});

	serial.on('close', (e) => {
		console.log('serial closed');
		if(e) console.log(e);
		scanPorts();
		serial = null;
	});

	serial.on('data', (data) => {
		console.log('data: ' + data);
	});
}

function disconnectSerial(){
	serial.close();
}

function scanAudioInputs(){
	inputDeviceInfos = [];
	document.getElementById('useAudio').disabled = true;
	document.getElementById('useAudio').innerHTML = 'Use';
	document.getElementById('scanAudio').disabled = false;
	document.getElementById('audioSelect').disabled = false;
	navigator.mediaDevices.enumerateDevices().then((devices) => {
		for(var device of devices){
			if(device.kind == 'audioinput'){
				console.log(device.label);
				inputDeviceInfos.push(device);
			}
		}
		updateAudioSelect(inputDeviceInfos);
	});
}

function updateAudioSelect(list){ //takes an array of comNames
	let inner = '';
	for(var item of list){
		inner += '<option value="' + item.deviceId + '">' + item.label + '</option>\n';
	}
	console.log(inner);
	document.getElementById('audioSelect').innerHTML = inner;
	if(list.length){
		document.getElementById('useAudio').disabled = false;
	}
}

function connectAudio(){
	if(audioCtx){
		disconnectAudio();
		return;
	}
	let s = document.getElementById('audioSelect');
	let constraints = {
		audio: {deviceId: {exact: s.options[s.selectedIndex].value}}
	};
	navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
		audioStream = stream;
		setupAudio();
		s.disabled = true;
		document.getElementById('useAudio').innerHTML = 'Unuse';
		document.getElementById('scanAudio').disabled = true;
	}).catch((reason) => {
		console.log('navigator.getUserMedia error: ', reason);
	});
}

function setupAudio(){
	audioCtx = new window.AudioContext();
	analyser = audioCtx.createAnalyser();
	source = audioCtx.createMediaStreamSource(audioStream);
	source.connect(analyser);
	analyser.fftSize = 8192;
	analyser.smoothingTimeConstant = 0;
	visualizeWaveform();
	visualizeSpectrum();

	audioCtx.onstatechange = () => {
		if(audioCtx.state == 'closed') audioCtx = null;
	};
}

function disconnectAudio(){
	window.cancelAnimationFrame(sAnimation);
	window.cancelAnimationFrame(wAnimation);
	audioCtx.close();
	scanAudioInputs();
}

function visualizeSpectrum(){
	sCanvas = document.getElementById('spectrum');
	sCtx = sCanvas.getContext('2d');
	let w = sCanvas.width;
	let h = sCanvas.height;
	let bufferLength = analyser.frequencyBinCount;
	let dataArray = new Uint8Array(bufferLength);
	sCtx.clearRect(0, 0, w, h);

	function draw(){
		sAnimation = window.requestAnimationFrame(draw);
		analyser.getByteFrequencyData(dataArray);

		sCtx.fillStyle = '#ccc';
		sCtx.fillRect(0, 0, w, h);

		sCtx.fillStyle = '#000';
		let sliceWidth = w*1.00/bufferLength;
		for(let i = 0; i < bufferLength; i++){
			sCtx.fillRect(i*sliceWidth, h, (i+1)*sliceWidth, -h*dataArray[i]/255.00);
		}
	}

	draw();
}

function visualizeWaveform(){
	wCanvas = document.getElementById('waveform');
	wCtx = wCanvas.getContext('2d');
	let w = wCanvas.width;
	let h = wCanvas.height;
	let bufferLength = analyser.frequencyBinCount;
	let dataArray = new Uint8Array(bufferLength);
	wCtx.clearRect(0, 0, w, h);

	function draw(){
		wAnimation = window.requestAnimationFrame(draw);
		analyser.getByteTimeDomainData(dataArray);

		wCtx.fillStyle = '#ccc';
		wCtx.fillRect(0, 0, w, h);

		wCtx.lineWidth = 2;
		wCtx.strokeStyle = '#000';
		wCtx.beginPath();
		let sliceWidth = w * 1.00 / bufferLength;
		let x = 0;
		for(var i = 0; i < bufferLength; i++) {
			var v = dataArray[i] / 128.0;
			var y = v * h/2;
			if(i == 0) {
				wCtx.moveTo(x, y);
			} else {
				wCtx.lineTo(x, y);
			}
			x += sliceWidth;
		}
		wCtx.lineTo(wCanvas.width, wCanvas.height/2);
		wCtx.stroke();
	}

	draw();
}
