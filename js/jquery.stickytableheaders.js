/*! Copyright (c) Jonas Mosbech - https://github.com/jmosbech/StickyTableHeaders
	MIT license info: https://github.com/jmosbech/StickyTableHeaders/blob/master/license.txt */
/*global module */

module.exports = function ($, window, undefined) {
	'use strict';

	var name = 'stickyTableHeaders',
		id = 0,
		TDTH_SELECTOR = 'th:not(td td, th th, td th, th td), td:not(td td, th th, td th, th td)',
		THEAD_SELECTOR = 'thead:first:not(thead thead)',
		defaults = {
			fixedOffset: 0,
			leftOffset: 0,
			marginTop: 0,
			objDocument: document,
			objHead: 'head',
			objWindow: window,
			scrollableArea: window,
			cacheHeaderHeight: false,
			// 横スクロールエリア
			optionalHorizontalScrollingArea: null,
			// 横スクロールに反応させる見出し行
			optionalStickyHeaderContent: null,
			// 横スクロールよりz-indexが大きいコンテンツ
			optionalStickyHeaderHidden: null,
			// 横スクロール見出し行のzindexオフセット
			zIndexOffset: 0,
			zIndex: 3
		};

	function Plugin (el, options) {
		// To avoid scope issues, use 'base' instead of 'this'
		// to reference this class from internal events and functions.
		var base = this;

		// Access to jQuery and DOM versions of element
		base.$el = $(el);
		base.el = el;
		base.id = id++;

		// Listen for destroyed, call teardown
		base.$el.bind('destroyed',
			$.proxy(base.teardown, base));

		// Cache DOM refs for performance reasons
		base.$clonedHeader = null;
		base.$originalHeader = null;

		// Cache header height for performance reasons
		base.cachedHeaderHeight = null;

		// Keep track of state
		base.isSticky = false;
		base.hasBeenSticky = false;
		base.leftOffset = null;
		base.topOffset = null;

		base.init = function () {
			base.setOptions(options);

			base.$el.each(function () {
				var $this = $(this);

				// remove padding on <table> to fix issue #7
				$this.css('padding', 0);

				base.$originalHeader = $(THEAD_SELECTOR, this);

				base.$clonedHeader = base.$originalHeader.clone();
				base.$clonedHeader.find('[id]').each(function(){
					var current = $(this);
					current.removeAttr('id');
				});

				$this.trigger('clonedHeader.' + name, [base.$clonedHeader]);

				if (base.$optionalHorizontalScrollingArea) {
					// 見出し行固定div作成
					// position: fixedでoverflow: hiddenが無効なので、
					// 二段構成のdivにする。
					// 外枠がfixedで、内枠がrelative + overflow: hidden
					// 外枠の作成
					base.$fixedHeadContainer = $('<div></div>').css({
						'position': 'fixed',
						'top':	0,
						'left': $(this).offset().left, // オリジナルと同じ位置に配置
						'display': 'none',
						'z-index': base.options.zIndex + base.options.zIndexOffset, // 常に上部に表示
					}).appendTo('body');

					// 内枠の作成
					base.$fixedHeadContainerContent = $('<div></div>').css({
						'width': base.$optionalHorizontalScrollingArea.width() + 'px',
					}).appendTo(base.$fixedHeadContainer)
						.append(base.$optionalStickyHeaderContent);

					// 横にスクロールできるように、relativeにして、スクロールに反応させてleftを調整する
					base.$optionalStickyHeaderContent.css({
						'position': 'relative',
					});

					// カスタムスクロール作成
					// 元のテーブルのoverflow: hiddenが画面に表示されていないときに
					// 表示されるスクロールバー
					// 元のテーブル要素をコピーしてクロールバーだけが表示されるdivを作る
					base.$scrollableOriginalHeader = $(this).clone();
					base.$scrollableOriginalHeader.find('tbody').remove();

					// 外枠の作成
					base.$fixedScrollingbarContainer = $('<div></div>', {
					}).css({
						'position': 'fixed',
						'bottom':	0,
						'display': 'none',
						'left': $(this).offset().left,
						'z-index': base.options.zIndex + base.options.zIndexOffset,
					}).appendTo('body');

					// 内枠の作成
					base.$fixedScrollingbarContainerContent = $('<div></div>').css({
						'overflow-x': 'auto',
						'overflow-y': 'hidden',
						'height': 19, // スクロールバーだけ表示する
						'width': base.$optionalHorizontalScrollingArea.width() + 'px',
					}).appendTo(base.$fixedScrollingbarContainer)
						.append(base.$scrollableOriginalHeader);

					// 横にスクロールできるように、relativeにして、スクロールに反応させてleftを調整する
					base.$scrollableOriginalHeader.css({
						'position': 'relative',
					});

					if (base.$optionalStickyHeaderHidden.length > 0) {
						var backgroundColor = '#fff';
						if (window.getComputedStyle) {
							backgroundColor = window.getComputedStyle(base.$optionalStickyHeaderHidden[0], null).getPropertyValue('background-color');
							if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
								backgroundColor = '#fff';
							}
						}
						base.$optionalStickyHeaderHidden.css({
							position: 'relative',
							// IEではrelative要素に対してz-indexは効かない
							'z-index': base.options.zIndex + base.options.zIndexOffset + 1,
							'background-color': backgroundColor,
						});
					}
				}

				base.$clonedHeader.addClass('tableFloatingHeader');
				base.$clonedHeader.css({display: 'none', opacity: 0.0});

				base.$originalHeader.addClass('tableFloatingHeaderOriginal');

				base.$originalHeader.after(base.$clonedHeader);

				base.$printStyle = $('<style type="text/css" media="print">' +
					'.tableFloatingHeader{display:none !important;}' +
					'.tableFloatingHeaderOriginal{position:static !important;}' +
					'</style>');
				base.$head.append(base.$printStyle);
			});
			
			base.$clonedHeader.find("input, select").attr("disabled", true);

			base.updateWidth();
			base.toggleHeaders();
			base.bind();
		};

		base.destroy = function (){
			base.$el.unbind('destroyed', base.teardown);
			base.teardown();
		};

		base.teardown = function(){
			if (base.isSticky) {
				base.$originalHeader.css('position', 'static');
			}
			$.removeData(base.el, 'plugin_' + name);
			base.unbind();

			base.$clonedHeader.remove();
			base.$originalHeader.removeClass('tableFloatingHeaderOriginal');
			base.$originalHeader.css('visibility', 'visible');
			base.$printStyle.remove();

			base.el = null;
			base.$el = null;
		};

		// 固定スクロールバー表示の判定
		base.bindFixedScrollbar = function(){
			if (!base.$optionalHorizontalScrollingArea) {
				return;
			}
			// テーブル要素の上部の位置
			var viewPointTop = base.$optionalHorizontalScrollingArea.offset().top + $(THEAD_SELECTOR, base.$el).height(); // 見出し行が表示された後のポジション
			// テーブル要素の下部の位置
			var viewPointBottom = base.$optionalHorizontalScrollingArea.offset().top + base.$optionalHorizontalScrollingArea.height();
			// Window座標
			var windowTop = $(window).scrollTop();
			var windowBottom = $(window).scrollTop() + $(window).height();
			// 横スクロールバーがない場合は非表示にする
			if (base.$fixedScrollingbarContainer.width() >= base.$el.width()) {
				base.$fixedScrollingbarContainer.css({display: 'none'});
				return;
			}
			// 対象テーブルが画面に表示されている場合は固定スクロール表示
			// 1. テーブル上部が表示されている場合
			// 2. テーブルが画面を占有してる場合
			if (windowTop < viewPointTop && viewPointTop < windowBottom || viewPointTop < windowTop && windowBottom < viewPointBottom) {
				base.$fixedScrollingbarContainer.css({display: ''});
			} else {
				base.$fixedScrollingbarContainer.css({display: 'none'});
			}
		};

		base.bind = function(){
			base.$scrollableArea.on('scroll.' + name, base.toggleHeaders);
			if (base.$optionalHorizontalScrollingArea) {
				base.$optionalHorizontalScrollingArea.on('scroll.' + name, base.toggleHeaders);
				base.$optionalHorizontalScrollingArea.on('rezise.' + name, base.toggleHeaders);
				base.$optionalHorizontalScrollingArea.on('rezise.' + name, base.updateWidth);

				// 実態のスクロールバーと固定スクロールバーの同期
				base.$fixedScrollingbarContainerContent.on('scroll.' + name, function(){
					base.$optionalHorizontalScrollingArea.scrollLeft($(this).scrollLeft());
					base.$optionalStickyHeaderContent.css({
						'left': -$(this).scrollLeft(),
					});
				});
				base.$optionalHorizontalScrollingArea.on('scroll.' + name, function() {
					base.$fixedScrollingbarContainerContent.scrollLeft($(this).scrollLeft());
					base.$optionalStickyHeaderContent.css({
						'left': -$(this).scrollLeft(),
					});
				});
				base.$window.on('scroll.' + name, function(){
					base.bindFixedScrollbar();
				});
			}

			if (!base.isWindowScrolling) {
				base.$window.on('scroll.' + name + base.id, base.setPositionValues);
				base.$window.on('resize.' + name + base.id, base.toggleHeaders);
			}
			base.$scrollableArea.on('resize.' + name, base.toggleHeaders);
			base.$scrollableArea.on('resize.' + name, base.updateWidth);
		};

		base.unbind = function(){
			// unbind window events by specifying handle so we don't remove too much
			base.$scrollableArea.off('.' + name, base.toggleHeaders);
			if (base.$optionalHorizontalScrollingArea) {
				base.$optionalHorizontalScrollingArea.off('.' + name, base.toggleHeaders);
				base.$optionalHorizontalScrollingArea.off('.' + name, base.updateWidth);
			}
			if (!base.isWindowScrolling) {
				base.$window.off('.' + name + base.id, base.setPositionValues);
				base.$window.off('.' + name + base.id, base.toggleHeaders);
			}
			base.$scrollableArea.off('.' + name, base.updateWidth);
		};

		// We debounce the functions bound to the scroll and resize events
		base.debounce = function (fn, delay) {
			var timer = null;
			return function () {
				var context = this, args = arguments;
				clearTimeout(timer);
				timer = setTimeout(function () {
					fn.apply(context, args);
				}, delay);
			};
		};

		base.toggleHeaders = base.debounce(function () {
			if (base.$el) {
				base.$el.each(function () {
					var $this = $(this),
						newLeft,
						newTopOffset = base.isWindowScrolling ? (
									isNaN(base.options.fixedOffset) ?
									base.options.fixedOffset.outerHeight() :
									base.options.fixedOffset
								) :
								base.$scrollableArea.offset().top + (!isNaN(base.options.fixedOffset) ? base.options.fixedOffset : 0),
						offset = $this.offset(),

						scrollTop = base.$scrollableArea.scrollTop() + newTopOffset,
						scrollLeft = base.$scrollableArea.scrollLeft(),

						headerHeight,

						scrolledPastTop = base.isWindowScrolling ?
								scrollTop > offset.top :
								newTopOffset > offset.top,
						notScrolledPastBottom;

					if (scrolledPastTop) {
						headerHeight = base.options.cacheHeaderHeight ? base.cachedHeaderHeight : base.$clonedHeader.height();
						notScrolledPastBottom = (base.isWindowScrolling ? scrollTop : 0) <
							(offset.top + $this.height() - headerHeight - (base.isWindowScrolling ? 0 : newTopOffset));
					}

					if (scrolledPastTop && notScrolledPastBottom) {
						newLeft = offset.left - scrollLeft + base.options.leftOffset;
						base.$originalHeader.css({
							'position': 'fixed',
							'margin-top': base.options.marginTop,
																												'top': 0,
							'left': newLeft,
							'z-index': base.options.zIndex
						});
						base.leftOffset = newLeft;
						base.topOffset = newTopOffset;
						base.$clonedHeader.css('display', '');

						if (base.$optionalHorizontalScrollingArea) {
							base.$fixedHeadContainerContent.css({
								'width': base.$optionalHorizontalScrollingArea.width() + 'px',
							});
							base.$fixedScrollingbarContainerContent.css({
								'width': base.$optionalHorizontalScrollingArea.width() + 'px',
							});
							base.$fixedHeadContainer.css('display', '');
							base.bindFixedScrollbar();
						}

						if (!base.isSticky) {
							base.isSticky = true;
							// make sure the width is correct: the user might have resized the browser while in static mode
							base.updateWidth();
							$this.trigger('enabledStickiness.' + name);
						}
						base.setPositionValues();
					} else if (base.isSticky) {
						base.$originalHeader.css('position', 'static');
						base.$clonedHeader.css('display', 'none');

						if (base.$optionalHorizontalScrollingArea) {
							base.$fixedHeadContainer.css('display', 'none');
							base.bindFixedScrollbar();
						}

						base.isSticky = false;
						base.resetWidth($(TDTH_SELECTOR, base.$clonedHeader), $(TDTH_SELECTOR, base.$originalHeader));
						if (base.$optionalHorizontalScrollingArea) {
							base.resetWidth($(TDTH_SELECTOR, base.$optionalStickyHeaderContent), $(TDTH_SELECTOR, base.$originalHeader));
							base.resetWidth($(TDTH_SELECTOR, base.$scrollableOriginalHeader), $(TDTH_SELECTOR, base.$originalHeader));
						}
						$this.trigger('disabledStickiness.' + name);
					}
				});
			}
		}, 0);

		base.setPositionValues = base.debounce(function () {
			var winScrollTop = base.$window.scrollTop(),
				winScrollLeft = base.$window.scrollLeft();
			if (!base.isSticky ||
					winScrollTop < 0 || winScrollTop + base.$window.height() > base.$document.height() ||
					winScrollLeft < 0 || winScrollLeft + base.$window.width() > base.$document.width()) {
				return;
			}
			base.$originalHeader.css({
				'top': base.topOffset - (base.isWindowScrolling ? 0 : winScrollTop),
				'left': base.leftOffset - (base.isWindowScrolling ? 0 : winScrollLeft)
			});

			if (base.$optionalHorizontalScrollingArea) {
				// windowの横スクロールバーに反応して、固定部のleftを調整
				var baseOffset = base.$optionalHorizontalScrollingArea.offset().left - winScrollLeft;
				base.$fixedHeadContainer.css({
					'left': baseOffset,
				});
				base.$fixedHeadContainerContent.css({
					'left': baseOffset,
				});
				base.$fixedScrollingbarContainer.css({
					'left': baseOffset,
				});
				base.$fixedScrollingbarContainerContent.css({
					'left': baseOffset,
				});
			}

		}, 0);

		base.updateWidth = base.debounce(function () {
			if (!base.isSticky) {
				return;
			}
			// Copy cell widths from clone
			if (!base.$originalHeaderCells) {
				base.$originalHeaderCells = $(TDTH_SELECTOR, base.$originalHeader);
			}
			if (!base.$clonedHeaderCells) {
				base.$clonedHeaderCells = $(TDTH_SELECTOR, base.$clonedHeader);
			}
			var cellWidths = base.getWidth(base.$clonedHeaderCells);
			base.setWidth(cellWidths, base.$clonedHeaderCells, base.$originalHeaderCells);
			if (base.$optionalHorizontalScrollingArea) {
				base.setWidth(cellWidths, base.$clonedHeaderCells, $(TDTH_SELECTOR, base.$optionalStickyHeaderContent));
				base.setWidth(cellWidths, base.$clonedHeaderCells, $(TDTH_SELECTOR, base.$scrollableOriginalHeader));
			}
			// Copy row width from whole table
			base.$originalHeader.css('width', base.$clonedHeader.width());

			// If we're caching the height, we need to update the cached value when the width changes
			if (base.options.cacheHeaderHeight) {
				base.cachedHeaderHeight = base.$clonedHeader.height();
			}
		}, 0);

		base.getWidth = function ($clonedHeaders) {
			var widths = [];
			$clonedHeaders.each(function (index) {
				var width, $this = $(this);

				if ($this.css('box-sizing') === 'border-box') {
					var boundingClientRect = $this[0].getBoundingClientRect();
					if(boundingClientRect.width) {
						width = boundingClientRect.width; // #39: border-box bug
					} else {
						width = boundingClientRect.right - boundingClientRect.left; // ie8 bug: getBoundingClientRect() does not have a width property
					}
				} else {
					var $origTh = $('th', base.$originalHeader);
					if ($origTh.css('border-collapse') === 'collapse') {
						if (window.getComputedStyle) {
							width = parseFloat(window.getComputedStyle(this, null).width);
						} else {
							// ie8 only
							var leftPadding = parseFloat($this.css('padding-left'));
							var rightPadding = parseFloat($this.css('padding-right'));
							// Needs more investigation - this is assuming constant border around this cell and it's neighbours.
							var border = parseFloat($this.css('border-width'));
							width = $this.outerWidth() - leftPadding - rightPadding - border;
						}
					} else {
						width = $this.width();
					}
				}

				widths[index] = width;
			});
			return widths;
		};

		base.setWidth = function (widths, $clonedHeaders, $origHeaders) {
			$clonedHeaders.each(function (index) {
				var width = widths[index];
				$origHeaders.eq(index).css({
					'min-width': width,
					'max-width': width
				});
			});
		};

		base.resetWidth = function ($clonedHeaders, $origHeaders) {
			$clonedHeaders.each(function (index) {
				var $this = $(this);
				$origHeaders.eq(index).css({
					'min-width': $this.css('min-width'),
					'max-width': $this.css('max-width')
				});
			});
		};

		base.setOptions = function (options) {
			base.options = $.extend({}, defaults, options);
			base.$window = $(base.options.objWindow);
			base.$head = $(base.options.objHead);
			base.$document = $(base.options.objDocument);
			base.$scrollableArea = $(base.options.scrollableArea);
			base.isWindowScrolling = base.$scrollableArea[0] === base.$window[0];
			// 横スクロール対応するには両方のオプションを必須にする
			if (base.options.optionalHorizontalScrollingArea && base.options.optionalStickyHeaderContent) {
				base.$optionalHorizontalScrollingArea= $(base.options.optionalHorizontalScrollingArea);
				base.$optionalStickyHeaderContent = $(base.options.optionalStickyHeaderContent);
				if (base.options.optionalStickyHeaderHidden) {
					base.$optionalStickyHeaderHidden = $(base.options.optionalStickyHeaderHidden);
				}
			}
		};

		base.updateOptions = function (options) {
			base.setOptions(options);
			// scrollableArea might have changed
			base.unbind();
			base.bind();
			base.updateWidth();
			base.toggleHeaders();
		};

		// Run initializer
		base.init();
	}

	// A plugin wrapper around the constructor,
	// preventing against multiple instantiations
	$.fn[name] = function ( options ) {
		return this.each(function () {
			var instance = $.data(this, 'plugin_' + name);
			if (instance) {
				if (typeof options === 'string') {
					instance[options].apply(instance);
				} else {
					instance.updateOptions(options);
				}
			} else if(options !== 'destroy') {
				$.data(this, 'plugin_' + name, new Plugin( this, options ));
			}
		});
	};

};
