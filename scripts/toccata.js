class GlobalManager {
	constructor() {
		this.inputFile = document.getElementById('InputFile');
		this.fileNameDisplay = document.getElementById('FileNameDisplay');
		this.nombre = document.getElementById('Nombre');
		this.tocArea = document.getElementById('TOCarea');
		this.config = null;
	}
}
const G = new GlobalManager();

// ファイルのオープン
G.inputFile.addEventListener('change', (evt) => {
	const file = evt.target.files[0];
	if (file == null)  return;

	G.fileNameDisplay.textContent = file['name'];

	let reader = new FileReader();
	reader.onload = function(evt) {
		let content = evt.target.result;
		G.config = analyseConfiguration(content)
		const toc = createTOClist(G.tocArea, G.config.toc);
		G.nombre.disabled = false;
		G.nombre.value = '';
		G.nombre.focus();
	};
	reader.readAsText(file);
});

// ノンブルの入力
G.nombre.addEventListener('keydown', (evt) => {
	if (evt.key === 'Enter' && !evt.isComposing) {
		evt.preventDefault();
		if (G.nombre.value.match(/\D/)) {
			alert("Invalid 'Page No.'");
			G.nombre.value = '';
		}
		openPage(G.nombre.value);
	} else if (evt.key === 'Escape') {
		evt.preventDefault();
		G.nombre.value = '';
	}
});

// ノンブル内容の全選択（focus時）
G.nombre.addEventListener('focus', (evt) => {
	G.nombre.select();
});

// タブのアクティブ時
document.addEventListener('visibilitychange', (evt) => {
	G.nombre.focus();
});

// タブ以外の空白文字をトリム
function trimSpacesAndNewlines(str) {
	const regex = /^[ \n\r]+|[ \n\r]+$/g;
	return str.replace(regex, '');
}

// 設定データ分析
function analyseConfiguration(data) {
	const lines = data.split('\n')
		.map(line => trimSpacesAndNewlines(line))
		.filter(line => line.length > 0);

	let currentSection = null;
	const result = {
		url: '',
		factorDiv: 2,
		factorOffset: 0,
		factorSub: 0,
		param: '',
		toc: [],
	};

	for (const line of lines) {
		if (line === '[URL]') {
			currentSection = 'url';
			continue;
		} else if (line === '[FACTOR]') {
			currentSection = 'factor';
			continue;
		} else if (line === '[PARAM]') {
			currentSection = 'param';
			continue;
		} else if (line === '[TOC]') {
			currentSection = 'toc';
			continue;
		}

		if (currentSection === 'url') {
			result.url = line;
		} else if (currentSection === 'factor') {
			const factor = line.split(/\s*,\s*/);
			result.factorDiv = factor[0];
			result.factorOffset = factor[1];
			result.factorSub = factor[2];
		} else if (currentSection === 'param') {
			result.param = line;
		} else if (currentSection === 'toc') {
			result.toc.push(line);
		}
	}
	return result;
}

// アイコンのアップデート
function updateIcon(iconSpan, isOpen) {
	iconSpan.textContent = isOpen ? '▼' : '▶';
}

// TOCリストの生成
function createTOClist(outputContainer, lines) {
	outputContainer.innerHTML = '';
	const rootContainer = document.createElement('div');
	rootContainer.classList.add('TOCcontainer');

	// スタック構造: { element: 親要素, depth: 深さ }
	const depthStack = [{ element: rootContainer, depth: -1 }];
	const allDetailsElements = []; 

	let pageSeqWork = 0;

	lines.forEach(line => {
		const depth = line.search(/\t/) === -1 ? 0 : line.search(/[^\t]/);
		const m = line.match(/^\t*(.+?),\s*(\d+)\s*$/);
		const content = (m == null) ? line.replace(/,\s*$/, '') : m[1];
		const page = (m == null) ? 0 : m[2];

		const pNo = Number(page);
		if ((pNo != 0) && (pNo < pageSeqWork)) {
			alert(`Page sequence error: ${pageSeqWork} > ${pNo}`);
		}
		pageSeqWork = pNo;

		if (!content) return;

		while (depthStack.length > 1 && depthStack[depthStack.length - 1].depth >= depth) {
			depthStack.pop();
		}

		const currentDetails = document.createElement('details');
		allDetailsElements.push(currentDetails);

		const summary = document.createElement('summary');

		const toggleIcon = document.createElement('span');
		toggleIcon.classList.add('toggle-icon');

		const summaryText = document.createElement('span');
		summaryText.classList.add('summary-text');
		summaryText.innerHTML = content;

		summary.appendChild(toggleIcon);
		summary.appendChild(summaryText);
		summary.pageNo = page;
		currentDetails.appendChild(summary);

		const subContainer = document.createElement('div');
		subContainer.classList.add('details-container');
		currentDetails.appendChild(subContainer);

		const currentParentContainer = depthStack[depthStack.length - 1].element;

		if(currentParentContainer === rootContainer) {
			currentParentContainer.appendChild(currentDetails);
		} else {
			currentParentContainer.querySelector('.details-container').appendChild(currentDetails);
		}

		depthStack.push({ element: currentDetails, depth: depth });
	});

	outputContainer.appendChild(rootContainer);

	allDetailsElements.forEach(detailsElement => {
		const summary = detailsElement.querySelector('summary');
		const iconSpan = detailsElement.querySelector('.toggle-icon');
		const contentText = detailsElement.querySelector('.summary-text').textContent;
		const subContainer = detailsElement.querySelector('.details-container');

		let hasContent = subContainer.children.length > 0;
		if (!hasContent) {
			detailsElement.classList.add('no-content');
			detailsElement.open = false; 
			iconSpan.textContent = '●';

			subContainer.remove(); 

			summary.addEventListener('click', (e) => {
				e.preventDefault(); 
				openPage(summary.pageNo);
			});

		} else {
			detailsElement.open = false; 

			updateIcon(iconSpan, detailsElement.open);

			summary.addEventListener('click', (e) => {
				e.preventDefault(); 
				const isIconClicked = e.target.closest('.toggle-icon') === iconSpan;

				if (isIconClicked) {
					detailsElement.open = !detailsElement.open; 
					updateIcon(iconSpan, detailsElement.open);

				} else {
					openPage(summary.pageNo);
				}
			});

			detailsElement.addEventListener('toggle', () => {
				updateIcon(iconSpan, detailsElement.open);
			});
		}
	});
}

// ページのオープン処理
function openPage(nombre) {
	const pno = Number(nombre);
	if (pno <= 0) {
		G.nombre.value = '';
		return;
	}
	const url = G.config.url;
	const factorDiv = G.config.factorDiv;
	const factorOffset = G.config.factorOffset;
	const factorSub = G.config.factorSub;
	const frameNo = Math.floor((pno - Number(factorSub)) / factorDiv) + Number(factorOffset);
	window.open(url + G.config.param + frameNo, '__blank');
}
