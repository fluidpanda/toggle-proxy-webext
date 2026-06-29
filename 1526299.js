let buttons = document.querySelectorAll('div[class="text"]');
let bport = browser.runtime.connect();

buttons.forEach(button => {
   button.addEventListener('click', event => {
		bport.postMessage({
			'id': event.target.id
		});
   });
});