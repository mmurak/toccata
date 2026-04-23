class GlobalManager {
	constructor() {
		this.binderId = document.getElementById("BINDERID");
		this.bookSelector = document.getElementById("BOOKSELECTOR");
		this.extraIndex = document.getElementById("EXTRAINDEX");
		this.nombre = document.getElementById('Nombre');
		this.tocArea = document.getElementById('TOCarea');
		this.config = null;
		this.sanitisedPath = null;
		this.indexHash = null;
	}
}
const G = new GlobalManager();
const R = new RegulatorNeo();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const cfgDir = urlParams.get('b');

if (cfgDir !== null) {
	G.sanitisedPath = `./assets/${cfgDir.replace(/[^a-zA-Z0-9_\/-]/g, '')}/`;
	fetch(G.sanitisedPath+'aabinder.cfg')
		.then(response => {
			if (!response.ok) throw new Error('File not found.');
				return response.text();
		})
		.then(content => {
			const arr = content.split(/\n/);
			G.binderId.innerHTML = `Binder: ${arr.shift()}（${cfgDir}）`;
			const exp = document.createElement('option');
			exp.innerHTML = '- 選択してください -';
			exp.value = '';
			G.bookSelector.appendChild(exp);
			for (let entry of arr) {
				if (entry === '') continue;
				const info = entry.split(/\|/);
				const item = document.createElement('option');
				item.innerHTML = `${info[0]}（${info[2]}/${info[4]}）${info[3]}`;
				item.value = info[1];
				G.bookSelector.appendChild(item);
			}
		})
		.catch(err => console.error(err));
} else {
	alert('バインダーパラメータ（b）が指定されていません。');
}

function bookChanger(elem) {
	fetch(G.sanitisedPath+elem.value)
		.then(response => {
			if (!response.ok) throw new Error(`${elem.value} not found.`);
				return response.text();
		})
		.then(content => {
			G.config = analyseConfiguration(content);
			const toc = createTOClist(G.tocArea, G.config.toc);
			createIndexData(G.extraIndex, G.config.index);
			G.nombre.disabled = false;
			G.nombre.value = '';
			G.nombre.focus();
		})
		.catch(err => console.error(err));
}

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
		missingInserted: [],
		param: '',
		toc: [],
		index: [],
	};

	for (const line of lines) {
		if (line === '[URL]') {
			currentSection = 'url';
			continue;
		} else if (line === '[FACTOR]') {
			currentSection = 'factor';
			continue;
		} else if (line === '[MISSING/INSERTED]') {
			currentSection = 'missingInserted';
			continue;
		} else if (line === '[PARAM]') {
			currentSection = 'param';
			continue;
		} else if (line === '[TOC]') {
			currentSection = 'toc';
			continue;
		} else if (line === '[INDEX]') {
			currentSection = 'index';
			continue;
		}

		if (currentSection === 'url') {
			result.url = line;
		} else if (currentSection === 'factor') {
			const factor = line.split(/\s*,\s*/);
			result.factorDiv = factor[0];
			result.factorOffset = factor[1];
			result.factorSub = factor[2];
		} else if (currentSection === 'missingInserted') {
			result.missingInserted.push(line);
		} else if (currentSection === 'param') {
			result.param = line;
		} else if (currentSection === 'toc') {
			result.toc.push(line);
		} else if (currentSection === 'index') {
			result.index.push(line);
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

	let pageSeqWork = -999;

	lines.forEach(line => {
		const depth = line.search(/\t/) === -1 ? 0 : line.search(/[^\t]/);
		const m = line.match(/^\t*(.+?),\s*(-?\d+)\s*$/);
		const content = (m == null) ? line.replace(/,\s*$/, '') : m[1];
		const page = (m == null) ? 0 : m[2];

		const pNo = Number(page);
		if ((pNo != 0) && (pNo < pageSeqWork)) {
			console.log(`Page sequence error: ${pageSeqWork} > ${pNo}`);
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

function createIndexData(element, idxData) {
	G.extraIndex.hidden = true;
	G.extraIndex.innerHTML = '';
	G.indexHash = {};
	let indexLabel = '';
	let page = 0;
	for (let ent of idxData) {
		const m = ent.match(/^>>>(.+?)>>>(\d+)>>>(.+)$/);
		if (m !== null) {
			if (G.extraIndex.hidden === true) {
				G.extraIndex.hidden = false;
				const instructor = document.createElement('option');
				instructor.innerHTML = '− 索引検索 −';
				instructor.value = '';
				G.extraIndex.appendChild(instructor);
			}
			const elem = document.createElement('option');
			indexLabel = m[1];
			elem.innerHTML = indexLabel;
			page = m[2];
			G.indexHash[indexLabel] = [];
			elem.value = m[3];
			G.extraIndex.appendChild(elem);
		} else {
			G.indexHash[indexLabel].push(`${ent},${page}`);
			page++;
		}
	}
}

function indexChanger(el) {
	const indexKey = el.options[el.selectedIndex].text;
	const charType = el.options[el.selectedIndex].value;
	G.extraIndex.selectedIndex = 0;
	let searchEntry = prompt(`検索語を${charType}で入力してください。`) ?? '';
	if (searchEntry !== '') {
		if (searchEntry.match(/^[a-zA-Z., \-]+$/)) {
			// 大文字→小文字変換
			searchEntry = searchEntry.toLowerCase();
			for (let i = G.indexHash[indexKey].length-1; i >= 0; i--) {
				const info = G.indexHash[indexKey][i];
				const m= info.match(/^(.+?),(\d+)$/);
				if (searchEntry >= m[1]) {
					openPage(m[2], 'indexPage');
					return;
				}
			}
		}else {
			// カタカナ→ひらがな変換
			searchEntry = searchEntry.replace(/[ァ-ン]/g, function(s) {
				return String.fromCharCode(s.charCodeAt(0) - 0x60);
			});
			for (let i = G.indexHash[indexKey].length-1; i >= 0; i--) {
				const info = G.indexHash[indexKey][i];
				const m= info.match(/^(.+?),(\d+)$/);
				if (R.compare(searchEntry, m[1]) >= 0) {
					openPage(m[2], 'indexPage');
					return;
				}
			}
		}
	}
}

function reviseMissingInserted(pno) {
	let delta = 0;
	G.config.missingInserted.forEach((p) => {
		const result = p.match(/^\s*(\d+)\s*,\s*([-+]?\d+)/);
		if (result === null) {
			alert(`[MISSING/INSERTED] parameter error: ${p}`);
			return 1;
		}
		if (pno >= Number(result[1])) {
			delta += Number(result[2]);
		}
	});
	return pno + delta;
}

// ページのオープン処理
function openPage(nombre, pageLabel='contentsPage') {
	let pno = Number(nombre);
	pno = reviseMissingInserted(pno);
	const url = G.config.url;
	const factorDiv = G.config.factorDiv;
	const factorOffset = G.config.factorOffset;
	const factorSub = G.config.factorSub;
	const frameNo = Math.floor((pno - Number(factorSub)) / factorDiv) + Number(factorOffset);
	window.open(url + G.config.param + frameNo, pageLabel);
}
