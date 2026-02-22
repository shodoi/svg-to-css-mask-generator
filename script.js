        // DOM要素の取得
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const generateBtn = document.getElementById('generateBtn');
        const originalPreview = document.getElementById('originalPreview');
        const maskPreview = document.getElementById('maskPreview');
        const cssVarOutput = document.getElementById('cssVarOutput');
        const cssUsageOutput = document.getElementById('cssUsageOutput');
        const fileInfoArea = document.getElementById('fileInfoArea');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const colorPicker = document.getElementById('colorPicker');

        let currentFile = null;
        let currentSvgContent = '';
        let currentFileName = '';
        let currentCssVarName = '';
        let currentCssVarValue = '';

        // トースト通知関数
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const toastMsg = document.getElementById('toastMsg');
            const toastIcon = document.getElementById('toastIcon');
            
            toastMsg.textContent = message;
            
            if (type === 'success') {
                toast.className = 'fixed bottom-6 right-6 px-6 py-3 rounded-xl text-white shadow-xl transition-all duration-300 z-50 transform translate-y-0 opacity-100 bg-gray-800 flex items-center gap-2 font-medium';
                toastIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            } else {
                toast.className = 'fixed bottom-6 right-6 px-6 py-3 rounded-xl text-white shadow-xl transition-all duration-300 z-50 transform translate-y-0 opacity-100 bg-red-600 flex items-center gap-2 font-medium';
                toastIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            }

            setTimeout(() => {
                toast.classList.replace('translate-y-0', 'translate-y-10');
                toast.classList.replace('opacity-100', 'opacity-0');
            }, 3000);
        }

        // コピー関数 (iframe制限回避のため execCommand を使用)
        window.copyText = function(elementId, btnElement) {
            const textarea = document.getElementById(elementId);
            if (!textarea.value) {
                showToast('コピーする内容がありません', 'error');
                return;
            }

            textarea.select();
            textarea.setSelectionRange(0, 99999); // モバイル対応

            try {
                document.execCommand('copy');
                
                // ボタンの見た目変更
                const originalHtml = btnElement.innerHTML;
                btnElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> コピー完了';
                btnElement.classList.add('bg-green-100', 'text-green-700');
                btnElement.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                
                showToast('クリップボードにコピーしました');
                
                setTimeout(() => {
                    btnElement.innerHTML = originalHtml;
                    btnElement.classList.remove('bg-green-100', 'text-green-700');
                    btnElement.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                }, 2000);
            } catch (err) {
                console.error('コピーに失敗しました', err);
                showToast('コピーに失敗しました', 'error');
            }
            
            window.getSelection().removeAllRanges();
        };

        // ドラッグ＆ドロップとクリックイベント
        dropzone.addEventListener('click', () => fileInput.click());
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.add('bg-blue-50', 'border-blue-400');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.remove('bg-blue-50', 'border-blue-400');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) handleFile(files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFile(e.target.files[0]);
        });

        // ファイル処理
        function handleFile(file) {
            if (file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
                showToast('SVGファイルを選択してください', 'error');
                return;
            }

            currentFile = file;
            currentFileName = file.name.replace(/\.svg$/i, '');
            
            // UIの更新
            fileNameDisplay.textContent = file.name;
            fileInfoArea.classList.remove('hidden');
            
            const reader = new FileReader();
            reader.onload = (e) => {
                currentSvgContent = e.target.result;
                originalPreview.innerHTML = currentSvgContent;
                
                const svgEl = originalPreview.querySelector('svg');
                if(svgEl) {
                    svgEl.style.maxWidth = '100%';
                    svgEl.style.maxHeight = '100%';
                    svgEl.style.width = 'auto';
                    svgEl.style.height = 'auto';
                }
                
                generateBtn.disabled = false;
                
                // 自動生成（オプション）
                // generateCSS(); 
            };
            reader.readAsText(file);
        }

        // Minify & CSS生成処理
        generateBtn.addEventListener('click', generateCSS);

        function generateCSS() {
            if (!currentSvgContent) return;

            const parser = new DOMParser();
            const doc = parser.parseFromString(currentSvgContent, "image/svg+xml");
            const svg = doc.querySelector("svg");

            if (!svg) {
                showToast("有効なSVGデータが見つかりません", 'error');
                return;
            }

            // 1. Minify: 不要なタグの削除
            ["title", "desc", "metadata", "style", "script"].forEach(tag => {
                svg.querySelectorAll(tag).forEach(el => el.remove());
            });

            // InkscapeやSodipodiなどの特定エディタ名前空間のタグを削除
            const removeNamespaceTags = (node) => {
                const els = Array.from(node.querySelectorAll('*'));
                els.forEach(el => {
                    if (el.tagName.includes(':')) {
                        el.remove();
                    }
                });
            };
            removeNamespaceTags(svg);

            // 不要な属性を再帰的に削除
            const cleanAttributes = (node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    // 削除する属性のリストを収集
                    const attrsToRemove = [];
                    Array.from(node.attributes).forEach(attr => {
                        const name = attr.name;
                        // xmlns:xxx, inkscape:xxx, sodipodi:xxx などの削除
                        if (name.includes(':') && name !== 'xmlns:xlink') {
                            attrsToRemove.push(name);
                        }
                        // id, class, xml:space, version などの描画に不要な属性
                        const ignoreList = ['id', 'class', 'version', 'xml:space'];
                        if (ignoreList.includes(name) || name.startsWith('data-')) {
                            attrsToRemove.push(name);
                        }
                    });

                    // 収集した属性を削除
                    attrsToRemove.forEach(attrName => {
                        node.removeAttribute(attrName);
                    });

                    // 子ノードへ再帰
                    node.childNodes.forEach(child => cleanAttributes(child));
                }
            };
            cleanAttributes(svg);

            // コメントノードの削除と空の g/defs の削除
            const cleanNodes = (node) => {
                for (let i = node.childNodes.length - 1; i >= 0; i--) {
                    const child = node.childNodes[i];
                    if (child.nodeType === 8) { // 8 = COMMENT_NODE
                        node.removeChild(child);
                    } else if (child.nodeType === 1) { // 1 = ELEMENT_NODE
                        cleanNodes(child);
                        // 中身がなくなった defs や g を削除
                        if ((child.tagName === 'defs' || child.tagName === 'g') && child.childNodes.length === 0) {
                            node.removeChild(child);
                        }
                    }
                }
            };
            cleanNodes(svg);

            // 最上位のxmlns属性の補完と最低限のクリーンアップ
            if (!svg.getAttribute("xmlns")) {
                svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            }

            // 2. サイズ(width/height)の取得と単位変換 (mm, pt等 -> px)
            const convertToPx = (val) => {
                if (!val) return null;
                const match = val.toString().match(/^([\d.]+)([a-z%]*)$/i);
                if (!match) return val;
                let num = parseFloat(match[1]);
                const unit = match[2].toLowerCase();
                switch(unit) {
                    case 'mm': num *= 3.779527559; break;
                    case 'cm': num *= 37.79527559; break;
                    case 'in': num *= 96; break;
                    case 'pt': num *= 1.333333333; break;
                    case 'pc': num *= 16; break;
                    case 'px': 
                    case '': return num; 
                    default: return val; 
                }
                return Math.round(num * 100) / 100;
            };

            let w = svg.getAttribute('width');
            let h = svg.getAttribute('height');
            let viewBox = svg.getAttribute('viewBox');

            if (w) {
                w = convertToPx(w);
                svg.setAttribute('width', w);
            }
            if (h) {
                h = convertToPx(h);
                svg.setAttribute('height', h);
            }
            if (viewBox) {
                // viewBox内の各数値も単位（あれば）を変換
                const processedViewBox = viewBox.split(/[\s,]+/).map(val => convertToPx(val)).join(' ');
                svg.setAttribute('viewBox', processedViewBox);
                viewBox = processedViewBox;
            }
            
            if (!w || !h) {
                if (viewBox) {
                    const vbParts = viewBox.split(/[\s,]+/);
                    w = w || vbParts[2];
                    h = h || vbParts[3];
                } else {
                    w = "24"; h = "24"; // 最悪のケースのフォールバック
                }
            }

            const formatSize = (val) => /^\d+(\.\d+)?$/.test(val) ? `${val}px` : val;
            const cssWidth = formatSize(w);
            const cssHeight = formatSize(h);

            // 3. 文字列化とエスケープ
            const serializer = new XMLSerializer();
            let minifiedSvg = serializer.serializeToString(svg);

            minifiedSvg = minifiedSvg
                .replace(/\r?\n|\r/g, '') // 改行削除
                .replace(/\s{2,}/g, ' ')  // 連続スペース削除
                .replace(/>\s+</g, '><')  // タグ間のスペース削除
                .replace(/"/g, "'")       // ダブルクォートをシングルクォートに
                .replace(/#/g, "%23");    // シャープをURLエンコード

            // 4. CSS変数の構築
            const safeVarName = currentFileName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
            currentCssVarName = `--${safeVarName || 'icon'}`;
            currentCssVarValue = `url("data:image/svg+xml;utf-8,${minifiedSvg}")`;
            
            const finalCssVar = `${currentCssVarName}: ${currentCssVarValue};`;
            
            // 5. CSSプロパティの構築
            const currentColor = colorPicker.value;
            const finalCssUsage = `display: inline-block;
mask-image: var(${currentCssVarName});
mask-size: contain;
mask-repeat: no-repeat;
block-size: ${cssHeight};
inline-size: ${cssWidth};
background-color: ${currentColor};`;

            // 出力
            cssVarOutput.value = finalCssVar;
            cssUsageOutput.value = finalCssUsage;

            // 6. マスクプレビューの反映
            updateMaskPreview(cssWidth, cssHeight);
            
            showToast('CSSの生成が完了しました');
        }

        // マスクプレビューの更新
        function updateMaskPreview(width = null, height = null) {
            if (!currentCssVarName) return;
            
            maskPreview.style.cssText = cssUsageOutput.value;
            // var(--xxx) の実体セット
            maskPreview.style.setProperty(currentCssVarName, currentCssVarValue);
            
            // プレビュー用に大きすぎる場合はスケールダウン（表示上の調整）
            const wVal = parseFloat(width || maskPreview.style.inlineSize);
            const hVal = parseFloat(height || maskPreview.style.blockSize);
            if(wVal > 150 || hVal > 150) {
                maskPreview.style.transform = `scale(${Math.min(150/wVal, 150/hVal)})`;
            } else {
                maskPreview.style.transform = 'none';
            }
        }

        // カラーピッカーの変更イベント
        colorPicker.addEventListener('input', (e) => {
            if (cssUsageOutput.value) {
                // テキストエリア内の background-color を置換
                cssUsageOutput.value = cssUsageOutput.value.replace(/background-color:\s*#[0-9a-fA-F]+;/, `background-color: ${e.target.value};`);
                if(currentCssVarName) {
                    maskPreview.style.backgroundColor = e.target.value;
                }
            }
        });

        // CSS変数の手動編集イベント
        cssVarOutput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (!val) return;

            // 正規表現で変数名とURL部分を抽出 (--name: url(...);)
            const match = val.match(/^(--[a-zA-Z0-9-]+)\s*:\s*(url\("data:image\/svg\+xml;.*?"\))\s*;?$/);
            
            if (match) {
                const oldVarName = currentCssVarName;
                currentCssVarName = match[1];
                currentCssVarValue = match[2];

                // 古い変数名がある場合はCSSプロパティ出力を更新
                if (oldVarName && oldVarName !== currentCssVarName) {
                    cssUsageOutput.value = cssUsageOutput.value.replaceAll(`var(${oldVarName})`, `var(${currentCssVarName})`);
                    // 古い変数をプレビューから削除
                    maskPreview.style.removeProperty(oldVarName);
                }

                updateMaskPreview();
            }
        });
