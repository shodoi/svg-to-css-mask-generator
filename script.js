// IIFEでカプセル化
(function () {
    'use strict';

    // DOM要素の取得
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const generateBtn = document.getElementById('generateBtn');
    const originalPreview = document.getElementById('originalPreview');
    const maskPreview = document.getElementById('maskPreview');
    const cssVarOutput = document.getElementById('cssVarOutput');
    const cssUsageOutput = document.getElementById('cssUsageOutput');
    const originalSvgCodeOutput = document.getElementById('originalSvgCodeOutput');
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

    // SVGサニタイズ関数（セキュリティ対策）
    function sanitizeSvg(svgString) {
        // 非標準の XML 宣言 (<!--?xml ... ?-->) がある場合、パースエラーになるため削除
        svgString = svgString.replace(/<!--\?xml[\s\S]*?\?-->/g, '');

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');

        // パースエラーのチェック
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('SVG Parsing Error:', parserError.textContent);
            return null;
        }

        const svg = doc.querySelector('svg');

        if (!svg) return null;

        // 危険な要素を削除
        const dangerousTags = ['script', 'foreignObject', 'iframe', 'embed', 'object', 'meta', 'link'];
        dangerousTags.forEach(tag => {
            svg.querySelectorAll(tag).forEach(el => el.remove());
        });

        // 危険な属性を削除
        const dangerousAttrs = ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'href'];
        const cleanAttrs = (node) => {
            if (node.nodeType === 1) {
                dangerousAttrs.forEach(attr => {
                    if (node.hasAttribute(attr)) {
                        // xlink:hrefは保持、javascript:始まりのhrefは削除
                        const val = node.getAttribute(attr);
                        if (attr === 'href' && val && !val.startsWith('javascript:')) {
                            return;
                        }
                        node.removeAttribute(attr);
                    }
                });
                node.childNodes.forEach(child => cleanAttrs(child));
            }
        };
        cleanAttrs(svg);

        // viewBoxがない場合、width/heightから自動生成
        if (!svg.getAttribute('viewBox')) {
            let w = svg.getAttribute('width');
            let h = svg.getAttribute('height');

            // 属性にない場合、styleから抽出を試みる
            if (!w || !h) {
                const style = svg.getAttribute('style') || '';
                const wMatch = style.match(/width:\s*([\d.]+)px/);
                const hMatch = style.match(/height:\s*([\d.]+)px/);
                if (wMatch) w = wMatch[1];
                if (hMatch) h = hMatch[1];
            }

            svg.setAttribute('viewBox', `0 0 ${w || '24'} ${h || '24'}`);
        }

        // width/height属性がない場合、viewBoxから自動生成
        if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(/[\s,]+/);
                if (!svg.getAttribute('width')) {
                    svg.setAttribute('width', parts[2] || '24');
                }
                if (!svg.getAttribute('height')) {
                    svg.setAttribute('height', parts[3] || '24');
                }
            }
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(svg);
    }

    // コピー関数（モダンAPI優先、フォールバック付き）
    window.copyText = async function (elementId, btnElement) {
        const textarea = document.getElementById(elementId);
        if (!textarea.value) {
            showToast('コピーする内容がありません', 'error');
            return;
        }

        try {
            // モダンClipboard APIを優先
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textarea.value);
            } else {
                // フォールバック: execCommand
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
            }

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
    };

    // ドラッグ＆ドロップとクリックイベント
    dropzone.addEventListener('click', () => fileInput.click());

    // キーボード操作対応（Enter/Spaceでファイル選択）
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

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
            // SVGをサニタイズしてから表示
            const sanitizedSvg = sanitizeSvg(e.target.result);
            if (!sanitizedSvg) {
                originalSvgCodeOutput.value = '';
                showToast('無効なSVGファイルです', 'error');
                return;
            }

            currentSvgContent = sanitizedSvg;
            originalSvgCodeOutput.value = currentSvgContent;
            originalPreview.innerHTML = currentSvgContent;

            const svgEl = originalPreview.querySelector('svg');
            if (svgEl) {
                // インラインstyle属性をクリアして、JSで制御
                svgEl.removeAttribute('style');

                const hasWidth = svgEl.hasAttribute('width');
                const hasHeight = svgEl.hasAttribute('height');

                if (hasWidth && hasHeight) {
                    // width, height が存在する場合はそのサイズ（等倍）で表示。
                    // ただしプレビュー枠（100%）を超えないようにする。
                    svgEl.style.maxWidth = '100%';
                    svgEl.style.maxHeight = '100%';
                } else {
                    // width, height が存在しない場合はコンテナのサイズに合わせる。
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.maxWidth = '100%';
                    svgEl.style.maxHeight = '100%';
                    svgEl.style.objectFit = 'contain';
                }
            }

            generateBtn.disabled = false;
        };

        reader.onerror = () => {
            originalSvgCodeOutput.value = '';
            showToast('ファイルの読み込みに失敗しました', 'error');
            generateBtn.disabled = true;
        };

        reader.readAsText(file);
    }

    // Minify & CSS生成処理
    generateBtn.addEventListener('click', generateCSS);

    function generateCSS() {
        if (!currentSvgContent) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(currentSvgContent, "image/svg+xml");
        let svg = doc.querySelector("svg");

        if (!svg) {
            showToast("有効なSVGデータが見つかりません", 'error');
            return;
        }

        // 1. Minify SVG via SVGO
        if (typeof SVGO !== 'undefined') {
            try {
                // SVGO設定: 不要な属性・要素を削除
                const result = SVGO.optimize(currentSvgContent, {
                    plugins: [
                        // 不要な属性を削除（fill, stroke, data-* 等）
                        {
                            name: 'removeAttrs',
                            params: {
                                attrs: [
                                    'fill',
                                    'stroke',
                                    'style',
                                    'class',
                                    'id',
                                    'version',
                                    'x',
                                    'y',
                                    'xml:space',
                                    'data-name',
                                    'data-*'
                                ]
                            }
                        },
                        // 不要な要素を削除
                        'removeStyleElement',
                        // preset-default（removeViewBoxは含まれないのでviewBoxは保持される）
                        'preset-default',
                    ]
                });

                // minify された SVG 文字列から再構築
                const minParser = new DOMParser();
                const minDoc = minParser.parseFromString(result.data, "image/svg+xml");
                const minSvg = minDoc.querySelector("svg");
                if (minSvg) {
                    svg.replaceWith(minSvg);
                    svg = minSvg; // 変数自体を新しいノードに上書き
                }
            } catch (e) {
                console.error("SVGO optimization failed:", e);
                // 失敗した場合は元のSVGをそのまま使用
            }
        }

        // SVG の width, height, viewBox を取得
        const widthAttr = svg.getAttribute('width');
        const heightAttr = svg.getAttribute('height');
        const viewBoxAttr = svg.getAttribute('viewBox');

        // 2. サイズ(width/height)の取得と単位変換 (mm, pt等 -> px)
        const convertToPx = (val) => {
            if (!val) return null;
            const match = val.toString().match(/^([\d.]+)([a-z%]*)$/i);
            if (!match) return val;
            let num = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            switch (unit) {
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

        let w = convertToPx(widthAttr);
        let h = convertToPx(heightAttr);
        let viewBox = viewBoxAttr;

        if (!w || !h) {
            if (viewBox) {
                const vbParts = viewBox.split(/[\s,]+/);
                w = w || convertToPx(vbParts[2]);
                h = h || convertToPx(vbParts[3]);
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

        // Data URI用のエスケープ処理
        minifiedSvg = minifiedSvg
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
mask-position: center;
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

        // プレビュー用に大きすぎる場合はコンテナに収める処理
        maskPreview.style.maxWidth = '100%';
        maskPreview.style.maxHeight = '100%';
    }

    // カラーピッカーの変更イベント
    colorPicker.addEventListener('input', (e) => {
        if (cssUsageOutput.value) {
            // テキストエリア内の background-color を置換
            cssUsageOutput.value = cssUsageOutput.value.replace(/background-color:\s*#[0-9a-fA-F]+;/, `background-color: ${e.target.value};`);
            if (currentCssVarName) {
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
})(); // IIFE終了
