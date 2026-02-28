// IIFEでカプセル化
(function () {
    'use strict';

    // DOM要素の取得
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const svgSourceInput = document.getElementById('svgSourceInput');
    const generateBtn = document.getElementById('generateBtn');
    const originalPreview = document.getElementById('originalPreview');
    const maskPreview = document.getElementById('maskPreview');
    const cssVarOutput = document.getElementById('cssVarOutput');
    const cssUsageOutput = document.getElementById('cssUsageOutput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const colorPicker = document.getElementById('colorPicker');
    const multiColorWarning = document.getElementById('multiColorWarning');
    const outputModeRadios = document.querySelectorAll('input[name="outputMode"]');
    const outputModeMask = document.getElementById('outputModeMask');
    const maskModeLabel = document.getElementById('maskModeLabel');

    let currentFile = null;
    let currentSvgContent = '';
    let currentFileName = '';
    let currentCssVarName = '';
    let currentCssVarValue = '';
    let isMultiColorSvg = false;

    // SVGO遅延読み込み（キャッシュ付き）
    let svgoOptimize = null;

    async function loadSvgo() {
        if (svgoOptimize) return svgoOptimize;
        try {
            const { optimize } = await import('https://cdn.jsdelivr.net/npm/svgo@4.0.0/dist/svgo.browser.js');
            svgoOptimize = optimize;
            return optimize;
        } catch (e) {
            console.warn('SVGO の読み込みに失敗しました:', e);
            return null;
        }
    }

    // SVGOを事前に読み込み開始（ノンブロッキング）
    loadSvgo();

    // ファイルサイズ上限（1MB）
    const MAX_FILE_SIZE = 1024 * 1024;

    // トースト通知関数
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        const toastIcon = document.getElementById('toastIcon');

        toastMsg.textContent = message;

        if (type === 'success') {
            toast.className = 'fixed bottom-4 right-4 px-4 py-2 rounded-lg text-white shadow-xl transition-all duration-300 z-50 transform translate-y-0 opacity-100 bg-gray-800 flex items-center gap-2 text-sm font-medium';
            toastIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else {
            toast.className = 'fixed bottom-4 right-4 px-4 py-2 rounded-lg text-white shadow-xl transition-all duration-300 z-50 transform translate-y-0 opacity-100 bg-red-600 flex items-center gap-2 text-sm font-medium';
            toastIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        }

        setTimeout(() => {
            toast.classList.replace('translate-y-0', 'translate-y-10');
            toast.classList.replace('opacity-100', 'opacity-0');
        }, 3000);
    }

    // 色値を正規化
    function normalizeColor(color) {
        if (!color) return '';
        color = color.toLowerCase().trim();
        // #fff -> #ffffff 形式に統一
        if (/^#[0-9a-f]{3}$/i.test(color)) {
            color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }
        return color;
    }

    // 複数色SVG検出関数
    function detectMultiColorSvg(svgContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) return false;

        const colors = new Set();

        // fill属性とstroke属性を収集
        const elements = svg.querySelectorAll('[fill], [stroke]');
        elements.forEach(el => {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');
            if (fill && fill !== 'none') {
                colors.add(normalizeColor(fill));
            }
            if (stroke && stroke !== 'none') {
                colors.add(normalizeColor(stroke));
            }
        });

        // style属性内の色も検査
        svg.querySelectorAll('[style]').forEach(el => {
            const style = el.getAttribute('style') || '';
            const fillMatch = style.match(/fill\s*:\s*([^;]+)/);
            const strokeMatch = style.match(/stroke\s*:\s*([^;]+)/);
            if (fillMatch) {
                const color = fillMatch[1].trim();
                if (color && color !== 'none') {
                    colors.add(normalizeColor(color));
                }
            }
            if (strokeMatch) {
                const color = strokeMatch[1].trim();
                if (color && color !== 'none') {
                    colors.add(normalizeColor(color));
                }
            }
        });

        // <style>要素内のCSSルールからも色を検査
        svg.querySelectorAll('style').forEach(styleEl => {
            const cssText = styleEl.textContent || '';
            for (const m of cssText.matchAll(/fill\s*:\s*([^;}\s]+)/gi)) {
                const color = m[1].trim();
                if (color && color !== 'none') {
                    colors.add(normalizeColor(color));
                }
            }
            for (const m of cssText.matchAll(/stroke\s*:\s*([^;}\s]+)/gi)) {
                const color = m[1].trim();
                if (color && color !== 'none') {
                    colors.add(normalizeColor(color));
                }
            }
        });

        // 単色（黒系・currentColor）のみの場合は除外
        const singleColors = ['black', '#000', '#000000', 'currentcolor', 'currentColor'];
        const filteredColors = [...colors].filter(c => !singleColors.includes(c));

        return filteredColors.length > 1;
    }

    // 複数色警告の更新
    function updateMultiColorWarning(svgContent) {
        isMultiColorSvg = detectMultiColorSvg(svgContent);

        const backgroundRadio = document.getElementById('outputModeBackground');

        if (isMultiColorSvg) {
            multiColorWarning.classList.remove('hidden');
            // 複数色SVGの場合: カラーアイコンモードをデフォルト選択（単色アイコンも選択可能）
            if (backgroundRadio) {
                backgroundRadio.checked = true;
                outputModeMask.checked = false;
            }
        } else {
            multiColorWarning.classList.add('hidden');
            // 単色SVGの場合: 単色アイコンモードをデフォルト選択
            outputModeMask.checked = true;
            if (backgroundRadio) {
                backgroundRadio.checked = false;
            }
        }
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

        // 危険な要素を削除（拡張版）
        // - script系: script, foreignObject, iframe, embed, object, meta, link
        // - 外部リソース参照: use, image, feImage
        // - アニメーション（イベントトリガー可能）: animate, animateTransform, animateMotion, set
        const dangerousTags = [
            'script', 'foreignObject', 'iframe', 'embed', 'object', 'meta', 'link',
            'use', 'image', 'feImage',
            'animate', 'animateTransform', 'animateMotion', 'set'
        ];
        dangerousTags.forEach(tag => {
            svg.querySelectorAll(tag).forEach(el => el.remove());
        });

        // <style>要素の内容をサニタイズ（外部リソース読み込みを防ぎつつ、内部スタイルは維持）
        svg.querySelectorAll('style').forEach(styleEl => {
            let css = styleEl.textContent || '';
            // @import による外部CSS読み込みを除去
            css = css.replace(/@import\s+[^;]+;?/gi, '');
            // @font-face による外部フォント読み込みを除去
            css = css.replace(/@font-face\s*\{[^}]*\}/gi, '');
            // url() による外部リソース参照を除去
            css = css.replace(/url\s*\([^)]*\)/gi, '');
            styleEl.textContent = css;
        });

        // 危険な属性を削除（全on*イベントハンドラに対応）
        const cleanAttrs = (node) => {
            if (node.nodeType === 1) {
                // 全属性を配列にコピー（削除中に配列が変わるのを防ぐ）
                const attrs = Array.from(node.attributes || []);
                attrs.forEach(attr => {
                    const attrName = attr.name.toLowerCase();
                    const attrValue = attr.value || '';

                    // 1. 全てのon*イベントハンドラを削除
                    if (attrName.startsWith('on')) {
                        node.removeAttribute(attr.name);
                        return;
                    }

                    // 2. javascript: URLを削除
                    if ((attrName === 'href' || attrName === 'xlink:href') &&
                        attrValue.toLowerCase().trim().startsWith('javascript:')) {
                        node.removeAttribute(attr.name);
                        return;
                    }

                    // 3. data: URL（base64等）の削除（画像以外）
                    if (attrName === 'href' || attrName === 'xlink:href') {
                        if (attrValue.toLowerCase().trim().startsWith('data:')) {
                            node.removeAttribute(attr.name);
                            return;
                        }
                    }

                    // 4. style属性内のurl()を削除（外部リソース読み込み防止）
                    if (attrName === 'style') {
                        const cleanedStyle = attrValue.replace(/url\s*\([^)]*\)/gi, '');
                        if (cleanedStyle !== attrValue) {
                            node.setAttribute(attr.name, cleanedStyle);
                        }
                    }
                });

                // 子要素も再帰的に処理
                node.childNodes.forEach(child => cleanAttrs(child));
            }
        };
        cleanAttrs(svg);

        // <a>タグのhref属性を削除（フィッシング防止）
        svg.querySelectorAll('a').forEach(el => {
            el.removeAttribute('href');
            el.removeAttribute('xlink:href');
        });

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
    async function copyText(elementId, btnElement) {
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
                // フォールバック: execCommand（非推奨だが互換性のため維持）
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
            }

            // ボタンの見た目変更
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> 完了';
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
    }

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

        if (file.size > MAX_FILE_SIZE) {
            showToast('ファイルサイズが大きすぎます（上限: 1MB）', 'error');
            return;
        }

        currentFile = file;
        currentFileName = file.name.replace(/\.svg$/i, '');

        // UIの更新
        fileNameDisplay.textContent = file.name;

        const reader = new FileReader();

        reader.onload = (e) => {
            // SVGをサニタイズしてから表示
            const sanitizedSvg = sanitizeSvg(e.target.result);
            if (!sanitizedSvg) {
                showToast('無効なSVGファイルです', 'error');
                return;
            }

            currentSvgContent = sanitizedSvg;

            // ペーストエリアにも表示
            svgSourceInput.value = currentSvgContent;

            // プレビューを更新
            updateOriginalPreview(currentSvgContent);

            // 複数色SVG警告を更新
            updateMultiColorWarning(currentSvgContent);

            generateBtn.disabled = false;
        };

        reader.onerror = () => {
            showToast('ファイルの読み込みに失敗しました', 'error');
            generateBtn.disabled = true;
        };

        reader.readAsText(file);
    }

    // プレビュー領域のプレースホルダーを設定
    function setPreviewPlaceholder() {
        originalPreview.textContent = '';
        const placeholder = document.createElement('span');
        placeholder.className = 'text-gray-400 text-xs';
        placeholder.textContent = '未選択';
        originalPreview.appendChild(placeholder);
    }

    // SVGソースペーストエリアの入力処理
    svgSourceInput.addEventListener('input', (e) => {
        const inputText = e.target.value.trim();

        if (!inputText) {
            currentSvgContent = '';
            fileNameDisplay.textContent = '';
            setPreviewPlaceholder();
            generateBtn.disabled = true;
            return;
        }

        // サニタイズ処理
        const sanitizedSvg = sanitizeSvg(inputText);
        if (!sanitizedSvg) {
            svgSourceInput.classList.add('border-red-500');
            showToast('無効なSVGです', 'error');
            return;
        }

        // バリデーション成功
        svgSourceInput.classList.remove('border-red-500');

        // グローバル変数を更新
        currentSvgContent = sanitizedSvg;
        currentFileName = 'pasted-svg';
        fileNameDisplay.textContent = 'ペーストしたSVG';

        // プレビューを更新
        updateOriginalPreview(sanitizedSvg);

        // 複数色SVG警告を更新
        updateMultiColorWarning(sanitizedSvg);

        generateBtn.disabled = false;
    });

    // Minify & CSS生成処理
    generateBtn.addEventListener('click', generateCSS);

    async function generateCSS() {
        if (!currentSvgContent) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(currentSvgContent, "image/svg+xml");
        let svg = doc.querySelector("svg");

        if (!svg) {
            showToast("有効なSVGデータが見つかりません", 'error');
            return;
        }

        // 1. Minify SVG via SVGO（動的インポート）
        const optimize = await loadSvgo();

        // 出力モードの取得（SVGO設定に影響）
        const outputMode = document.querySelector('input[name="outputMode"]:checked').value;

        if (optimize) {
            try {
                // 単色アイコンモードとカラーアイコンモードで最適化設定を分ける
                // 単色アイコン: 積極的に不要な色属性・スタイルも除去してさらにminify
                // カラーアイコン: 色情報を維持したまま最小限のminify
                const svgoPlugins = [
                    {
                        name: 'preset-default',
                        params: {
                            overrides: {
                                // viewBoxを削除しない（重要）
                                removeViewBox: false,
                                // 形状をpathに変換しない（座標ずれを防ぐ）
                                convertShapeToPath: false,
                                // パスデータを変換しない（表示が変わる可能性）
                                convertPathData: false,
                                // IDを削除しない（参照がある可能性）
                                cleanupIDs: false,
                                // インラインスタイルをバラさない（色情報の保持）
                                inlineStyles: false,
                                // スタイルをマージしない（色情報を保持）
                                mergeStyles: false,
                                // 色の正規化はカラーアイコンでも問題なし
                                convertColors: false
                            }
                        }
                    },
                    // 不要な属性を削除
                    {
                        name: 'removeAttrs',
                        params: {
                            attrs: [
                                'version',
                                'xml:space',
                                'data-name'
                            ]
                        }
                    },
                    // コメントを削除
                    'removeComments',
                    // エディタデータを削除
                    'removeEditorsNSData',
                    // メタデータを削除
                    'removeMetadata',
                    // タイトルと説明を削除
                    'removeTitle',
                    'removeDesc'
                ];

                const result = optimize(currentSvgContent, { plugins: svgoPlugins });

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

        // ---- 両モード共通: ルートSVG要素の不要属性を除去 ----
        // xml:space: SVGの空白処理用。CSSでの利用では不要（SVGOでマッチしない場合の保険）
        svg.removeAttribute('xml:space');
        // x, y: ルートSVGに不要な位置指定
        svg.removeAttribute('x');
        svg.removeAttribute('y');
        // id: Adobe IllustratorなどのAI生成ID（参照されていなければ不要）
        // ただし、SVG内から参照されているIDは保持する
        {
            const rootId = svg.getAttribute('id');
            if (rootId) {
                // SVG内の他の要素から参照されているか確認（url(#id), href="#id" など）
                const svgStr = svg.innerHTML;
                const isReferenced = svgStr.includes(`#${rootId}`) || svgStr.includes(`url(#${rootId})`);
                if (!isReferenced) {
                    svg.removeAttribute('id');
                }
            }
        }
        // style属性のwidth/height/opacityデフォルト値を除去（固定サイズはCSSスケーリングを妨げる）
        {
            const styleAttr = svg.getAttribute('style');
            if (styleAttr) {
                let styleStr = styleAttr
                    // width/heightを除去
                    .replace(/\bwidth\s*:[^;]+;?/gi, '')
                    .replace(/\bheight\s*:[^;]+;?/gi, '')
                    // opacity:1（デフォルト値）を除去
                    .replace(/\bopacity\s*:\s*1\s*;?/gi, '')
                    .trim()
                    .replace(/;+$/, ''); // 末尾のセミコロンを除去
                if (styleStr) {
                    svg.setAttribute('style', styleStr);
                } else {
                    svg.removeAttribute('style'); // 空になれば属性ごと削除
                }
            }
        }
        // -------------------------------------------------

        // ※ここで編集するsvgはCSS生成用のローカルコピーであり、プレビューに表示されるSVGとは別
        if (outputMode === 'mask') {
            // <style>要素を削除（色定義はマスクに不要）
            svg.querySelectorAll('style').forEach(el => el.remove());

            svg.querySelectorAll('*').forEach(el => {
                // class属性を削除（スタイル参照先が消えたため不要）
                el.removeAttribute('class');

                // fill属性: "none"以外を削除（noneは形状に影響するため維持）
                const fill = el.getAttribute('fill');
                if (fill && fill.toLowerCase() !== 'none') {
                    el.removeAttribute('fill');
                }

                // stroke属性: "none"以外を削除
                const stroke = el.getAttribute('stroke');
                if (stroke && stroke.toLowerCase() !== 'none') {
                    el.removeAttribute('stroke');
                }
            });

            // 空になった<defs>を削除
            svg.querySelectorAll('defs').forEach(el => {
                if (el.children.length === 0) el.remove();
            });
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
            .replace(/%/g, "%25")     // %を最初にエスケープ（二重エンコード防止）
            .replace(/"/g, "'")       // ダブルクォートをシングルクォートに
            .replace(/#/g, "%23")     // シャープをURLエンコード
            .replace(/</g, "%3C")     // 山括弧（開）をURLエンコード
            .replace(/>/g, "%3E");    // 山括弧（閉）をURLエンコード

        // 4. CSS変数の構築
        const safeVarName = currentFileName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        currentCssVarName = `--${safeVarName || 'icon'}`;
        currentCssVarValue = `url("data:image/svg+xml;charset=utf-8,${minifiedSvg}")`;

        const finalCssVar = `${currentCssVarName}: ${currentCssVarValue};`;

        // 5. CSSプロパティの構築
        const currentColor = colorPicker.value;

        let finalCssUsage;
        if (outputMode === 'mask') {
            // mask-image モード（単色アイコン）
            finalCssUsage = `display: inline-block;
mask-image: var(${currentCssVarName});
mask-size: contain;
mask-position: center;
mask-repeat: no-repeat;
block-size: ${cssHeight};
inline-size: ${cssWidth};
background-color: ${currentColor};`;
        } else {
            // background-image モード（カラーアイコン）
            finalCssUsage = `display: inline-block;
background-image: var(${currentCssVarName});
background-size: contain;
background-position: center;
background-repeat: no-repeat;
block-size: ${cssHeight};
inline-size: ${cssWidth};`;
        }

        // 出力
        cssVarOutput.value = finalCssVar;
        cssUsageOutput.value = finalCssUsage;

        // 6. プレビューの反映
        updatePreview(cssWidth, cssHeight, outputMode);

        showToast('CSSの生成が完了しました');
    }

    // オリジナルSVGプレビューの更新（安全なDOM操作）
    function updateOriginalPreview(svgContent) {
        if (!svgContent) return;

        // 既存のプレビュー内容をクリア
        originalPreview.textContent = '';

        // DOMParserで安全にSVGをパースし、importNodeでDOMに挿入
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const parsedSvg = doc.querySelector('svg');

        if (!parsedSvg) return;

        const svgEl = document.importNode(parsedSvg, true);
        originalPreview.appendChild(svgEl);

        // インラインstyle属性をクリアして、JSで制御
        svgEl.removeAttribute('style');

        const hasWidth = svgEl.hasAttribute('width');
        const hasHeight = svgEl.hasAttribute('height');

        if (hasWidth && hasHeight) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.maxHeight = '100%';
        } else {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.maxWidth = '100%';
            svgEl.style.maxHeight = '100%';
            svgEl.style.objectFit = 'contain';
        }
    }

    // プレビューの更新（mask-image / background-image 共用）
    function updatePreview(width = null, height = null, outputMode = 'mask') {
        if (!currentCssVarName) return;

        maskPreview.style.cssText = cssUsageOutput.value;
        // var(--xxx) の実体セット
        maskPreview.style.setProperty(currentCssVarName, currentCssVarValue);

        // プレビュー用に大きすぎる場合はコンテナに収める処理
        maskPreview.style.maxWidth = '100%';
        maskPreview.style.maxHeight = '100%';

        // background-imageモードの場合はカラーピッカーを無効化
        const colorPickerContainer = colorPicker.closest('div');
        if (outputMode === 'background') {
            colorPicker.disabled = true;
            colorPicker.style.opacity = '0.5';
            colorPicker.style.cursor = 'not-allowed';
            if (colorPickerContainer) {
                colorPickerContainer.style.opacity = '0.5';
                colorPickerContainer.style.pointerEvents = 'none';
            }
        } else {
            colorPicker.disabled = false;
            colorPicker.style.opacity = '1';
            colorPicker.style.cursor = 'pointer';
            if (colorPickerContainer) {
                colorPickerContainer.style.opacity = '1';
                colorPickerContainer.style.pointerEvents = 'auto';
            }
        }
    }

    // 後方互換性のためのエイリアス
    function updateMaskPreview(width = null, height = null) {
        updatePreview(width, height, 'mask');
    }

    // 出力モード切り替えイベント
    outputModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            // CSSが生成済みの場合は再生成
            if (currentSvgContent && currentCssVarName) {
                generateCSS();
            }
        });
    });

    // カラーピッカーの変更イベント
    colorPicker.addEventListener('input', (e) => {
        const outputMode = document.querySelector('input[name="outputMode"]:checked').value;

        // background-imageモードの場合は何もしない
        if (outputMode === 'background') return;

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
        const match = val.match(/^(--[a-zA-Z0-9-]+)\s*:\s*(url\("data:image\/svg\+xml;[^"]*"\))\s*;?$/);

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

    // CSSプロパティの手動編集イベント（リアルタイムプレビュー更新）
    cssUsageOutput.addEventListener('input', () => {
        if (!currentCssVarName || !currentCssVarValue) return;
        updateMaskPreview();
    });

    // コピーボタンのイベントリスナー登録（インラインonclick属性の代替）
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
        btn.addEventListener('click', function () {
            copyText(this.dataset.copyTarget, this);
        });
    });
})(); // IIFE終了
