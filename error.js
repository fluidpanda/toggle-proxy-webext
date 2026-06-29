document.querySelector('#error').innerText = atob(new URLSearchParams(window.location.search).get('data'));

let bport = browser.runtime.connect({
	name: 'error'
});

document.querySelector('#options').addEventListener('click', e => {
	bport.postMessage({
		id: 'options'
	});
});