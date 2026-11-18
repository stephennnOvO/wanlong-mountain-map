function sourcePhoto(imageId, title, caption) {
  $('reference-title').textContent = title;
  $('reference-image').src = $(imageId).src;
  $('reference-image').alt = title;
  $('reference-caption').textContent = caption;
  $('reference-modal').hidden = false;
  $('reference-close').focus();
}

function addDiningLink(h, d) {
  if (h.id !== 1 && h.id !== 2) return;
  const button = document.createElement('button');
  button.className = 'secondary';
  button.textContent = h.id === 2 ? '双龙自助 · 雪季主题菜单' : '龙景轩 · 早餐与下午茶';
  button.onclick = () => selectDining(h.id);
  d.append(button);
}

const diningPanel = $('dining-panel');
const diningThemes = [
  ['11月', '螃蟹主题', '清蒸蟹、避风塘风味'],
  ['12月', '红酒主题', '牛腩、鲍鱼与暖冬红酒料理'],
  ['1月', '鹅肝主题', '现煎及红酒风味'],
  ['2月', '海鱼主题', '三文鱼、鲷鱼、海鲈鱼等'],
  ['3月', '银鳕鱼主题', '炭烧、香茅烤制及香煎等'],
];
diningPanel.innerHTML = `<header class="detail-top"><h2 id="dining-title">餐饮</h2><button class="close" id="dining-close" aria-label="收起餐饮">收起 ×</button></header>
 <h3 class="dining-title">双龙自助晚餐</h3>
 <p class="guest-description">位于双龙酒店二层。雪季主题菜品按月轮换。</p>
 <div class="dining-menu">${diningThemes.map(([month, title, description]) => `<details><summary><span>${month}</span>${title}<b aria-hidden="true"></b></summary><p>${description}</p></details>`).join('')}</div>
 <button class="secondary" id="dining-shuanglong">查看双龙酒店</button>
 <h3 class="dining-title" id="dining-longjing">龙景轩 · 中西自助早餐</h3>
 <p class="guest-description">位于龙宫酒店五层。提供中式热食、广式点心、西式烘焙、沙拉与果饮。</p>
 <h3 class="dining-title">龙景轩 · 下午茶</h3>
 <p class="guest-description">供应甜点、茶饮与小食。</p>
 <button class="secondary" id="dining-dragon">查看龙宫酒店</button>
 <p class="guest-description dining-validity">菜单、价格及营业时间以餐厅当日安排为准。</p>`;

function selectDining(fromHotel = null) {
  exitExperience(false);
  diningPanel.hidden = false;
  const body = diningPanel.querySelector('.panel-scroll');
  if (body) body.scrollTop = fromHotel === 1 ? $('dining-longjing').offsetTop - body.offsetTop : 0;
}

$('dining-close').onclick = () => (diningPanel.hidden = true);
$('dining-shuanglong').onclick = () => selectHotel(2);
$('dining-dragon').onclick = () => selectHotel(1);
$('dining-toggle').onclick = () => selectDining();
