/*
# jquery.imuplo.js v0.8.15.2
# HTML5 file uploader plugin for jQuery - released under MIT License 
# Author: Alexandr Kabanov <alex.k.isdg@gmail.com>
# http://github.com/buffk/imuplo.js
# Copyright (c) 2015 Alexandr Kabanov
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# o use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
*/

(function ( $ ) {
	$.fn.Imuplo = function ( opt ) {
		if ( typeof(opt) !== 'object' ) opt = {};
		if ( typeof(opt.jcrop) !== 'object' ) opt.jcrop = {};
		var $options = $.extend( {}, $.fn.Imuplo.defaults, opt ),
			$jcrop = $.extend( {}, $.fn.Imuplo.defaults.jcrop, opt.jcrop ),
			$fx = $.extend( {}, $.fn.Imuplo.defaults.FX, opt.FX ),
			$files,
			$fileObj = {},
			$error = '',
			$locked = false,
			$publicStatus = 'Image is not selected',
			$this = $(this);

		$.each( ['onChange','onFXReady','onReadyForUpload','onError'], function( i, e ) {
			if ( typeof( $options[e] ) !== 'function' ) $options[e] = function () {};
		});

		if ( $this.data( 'Imuplo' ) ) killAll( $options.previewContainerID ); else $this.data( 'Imuplo', true );
		if ( $locked ) return;
		var $parentContainer = $this.parent(  ),
			fileInputID = 'imuplo-input-file';
		if ( isElExist( fileInputID ) ) {
			$( '#' + fileInputID ).remove();
		}
		$parentContainer.append( '<input type="file" id="' + fileInputID + '" accept="' + $options.acceptFileTypes + '" multiple="' + $options.multiple + '" style="display: none;" />' );

		$( '#' + fileInputID ).click ( );

		$( '#' + fileInputID ).bind({
			change: function( ) {
				if ( $options.multiple && false) // FIX: not multiple at this version
					$files = this.files;
				else
					$files = this.files[0];

				if ( isValidFiles ( $files ) ) {
					$publicStatus = $files.name + ' selected for upload';
					$options.onChange.call( $this, $publicStatus );
					if ( window.File && window.FileReader && window.FileList && window.Blob ) {
						getFileData( $files, $parentContainer ); // load $fileObj
						$parentContainer.bind( 'dataReady', function ( ) {
							$parentContainer.unbind( 'dataReady' );
							if ( !isValidImage( [$fileObj.width, $fileObj.height] ) ) {
								killAll( $options.previewContainerID );
								$options.onError.call( this, $error );
								return;
							}
							if ( $options.outputType != false && $options.outputType != $fileObj ) {
								convertImageFormat( $parentContainer );
							}
														
							if ( $options.resize && $options.resizeMethod !== false ) {
								var newImg;
								if ( imageResize( $fileObj, $options.resizeMethod, $parentContainer ) ) {
									if ( $options.resizeMethod == 'standard' && !$options.addFX )
										$options.onReadyForUpload.call( this, $fileObj );
								} else {
									$options.onError.call( this, $error );
								}
							} else {
								if ( $options.previewContainerID !== false )
									showImage( $options.previewContainerID );
								if ( !$options.addFX )
									$options.onReadyForUpload.call( this, $fileObj );
							}

							if ( $options.addFX ) {
								fxContainer = getFXInterface();
								if ( fxContainer !== false )
									$parentContainer.bind( 'fxCanvasReady', function ( ) {
										drawFX( fxContainer );
									});
								else {
									$options.onError.call( this, $error );
								}
							}
						});
					} else {
						$error = 'The File APIs are not supported in your browser';
						$options.onError.call( $this, $error );
						$options.onReadyForUpload.call( $this, {
							size: $files.size,
							name: $files.name,
							type: $files.type,
							src: null,
							width: null,
							height: null,
							blob: $files
						} );
					}
				} else {
					$publicStatus = 'Image is not selected';
					$options.onError.call( $this, $error );
				}
				$( '#' + fileInputID ).remove();
			}
		});

		// internal functions
		// - - - - - - - - - -
		function isElExist( id ) {
			var el =  document.getElementById( id );
			if ( typeof(el) != 'undefined' && el != null ) {
				return true;
			}
			return false;
		}

		function convertImageFormat ( wrapper ) {
			var extensions = {
				'image/jpeg':'jpg',
				'image/png':'png',
				'image/vnd.wap.wbmp':'wbmp',
				'image/x-windows-bmp':'bmp',
				'image/bmp':'bmp',
				'image/vnd.microsoft.icon':'ico',
				'image/x-icon':'ico',
				'image/tiff':'tiff',
				'image/svg+xml':'svg',
				'image/pjpeg':'jpg',
				'image/gif':'gif',
				'image/*':'jpg'
			};
			if ( $options.outputType == 'image/*' ) $options.outputType = 'image/jpeg';
			wrapper.append('<canvas id="imuplo-tmp-canvas" style="display: none;"></canvas>');
			canv = document.getElementById('imuplo-tmp-canvas');
			canv.width = $fileObj.width;
			canv.height = $fileObj.height;
			canv.getContext('2d').drawImage( $fileObj.imobj, 0, 0, $fileObj.width, $fileObj.height );
			$fileObj.src = canv.toDataURL( $options.outputType, $options.compression );
			$fileObj.type = $options.outputType;
			$fileObj.blob = dataURItoBlob( $fileObj.src );
			$fileObj.size = $fileObj.blob.size;
			var tmp = $fileObj.name.split( '.' );
			tmp.pop();
			$fileObj.name = tmp.join( '.' ) + '.' + extensions[$options.outputType];
			$( '#imuplo-tmp-canvas' ).remove();
		}

		function imageResize( o, method, wrapper ) {
			var ob = {},
				wrapperId = wrapper.attr( 'id' ),
				w = o.width,
				h = o.height,
				sx = ( $options.scaleTo[0] ),
				sy = ( $options.scaleTo[1] ),
				aspectRX = 1,
				aspectRY = 1,
				nw = w,
				nh = h,
				centreX = 0,
				centreY = 0;

			if ( ( !sx || !sy ) && method == 'standard' ) {
				if ( $fileObj.cropSize[0] > 0 && $fileObj.cropSize[1] > 0 ) {
					sx = $fileObj.cropSize[0];
					sy = $fileObj.cropSize[1];
				} else {
					$error = 'Option "scaleTo" is undefined';
					return false;
				}
			}

			if ( wrapperId == undefined ) {
				wrapperId = 'imuplo-tc-wrapper';
				wrapper.attr( 'id', wrapperId );
			} else {
				if ( wrapperId.length < 1 ) {
					wrapperId = 'imuplo-tc-wrapper';
					wrapper.attr( 'id', wrapperId );
				}
			}
			switch (method) {
				case 'standard':
					if ( $fileObj.cropSize[0] > 0 && $fileObj.cropSize[1] > 0 ) {
						centreX = $fileObj.cropOffset[0];
						centreY = $fileObj.cropOffset[1];
						nw = $fileObj.cropSize[0];
						nh = $fileObj.cropSize[1];
					} else {
						aspectRX = w/sx;
						aspectRY = h/sy;
						if ( w >= h ) {
							nw = (sx*aspectRY) | 0;
							if (nw > w) nw = w;
							nh = h;
							centreX = (w/2 - nw/2) | 0;
							centreY = 0;
						} else {
							nw = w;
							nh = (sy*aspectRX) | 0;
							if (nh > h) nh = h;
							centreX = 0;
							centreY = (h/2 - nh/2) | 0;
						}
					}
					wrapper.append('<canvas id="imuplo-tmp-canvas" style="display: none;"></canvas>');
					canv = document.getElementById('imuplo-tmp-canvas');
					canv.width = sx;
					canv.height = sy;
					canv.getContext('2d').drawImage( o.imobj, centreX, centreY, nw, nh, 0, 0, sx, sy);
					ob.src = canv.toDataURL( $options.outputType, $options.compression );
					ob.width = sx;
					ob.height = sy;
					ob.blob = dataURItoBlob( ob.src );
					$fileObj = $.extend( o, ob );
					$fileObj.imobj.src = ob.src;
					$( '#imuplo-tmp-canvas' ).remove();
					$fileObj.imobj.onload = function( ) { $parentContainer.trigger( 'onResizeReady' ); }
					// Show it
					if ( $options.previewContainerID !== false && !$options.addFX ) {
						showImage( $options.previewContainerID );
					}
				break;
				case 'jcrop':
					if ( $options.previewContainerID !== false ) {
						var cropper = showImage( $options.previewContainerID );
						var jcAPI;
						if ( cropper === false ) {
							$error = 'Preview container is not finded';
							return false;
						} else {
							cropper.load( function() {
								cropper.Jcrop( {
									boxWidth: cropper.width(),
									boxHeight: cropper.height(),
									onChange: updateCropRegion,
									onSelect: updateCropRegion,
									setSelect: [ 0, 0, $options.minImageSize[0], $options.minImageSize[1] ],
									minSize:[ $options.minImageSize[0], $options.minImageSize[1] ],
									aspectRatio: $options.jcrop.aspect
								}, function ( ) {
									jcAPI = this;
									$( '#' + $options.previewContainerID + '>div.jcrop-active>canvas' ).attr( 'id', 'imuplo-fx-canvas' );
									jcAPI.animateTo([ 0, 0, cropper.width(), cropper.height() ]);
									$parentContainer.trigger( 'fxCanvasReady' );
								});

								if ( $jcrop.displayThumb === true ) {
									if ( isElExist( $options.previewContainerID + '-crop-thumb' ) )
										$('div.' + $jcrop.thumbClass).remove();
									$( '#' + $options.previewContainerID ).parent().append(
										'<div style="width:' + $jcrop.thumbSize[0] + 'px; height:' + $jcrop.thumbSize[1]
										+ 'px; overflow: hidden;" class="' + $jcrop.thumbClass + '"><img id="' + $options.previewContainerID
										+ '-crop-thumb" src="' + cropper.attr("src") + '" /></div>'
									);
								}
								if ( isElExist( $options.previewContainerID + '-bt-ready' ) )
									$('#' + $options.previewContainerID + '-bt-ready').remove();
									$( '#' + $options.previewContainerID )
									.parent()
									.append(
										'<a href="#' + $options.previewContainerID + '" id="' + $options.previewContainerID + '-bt-ready" class="'
										+ $jcrop.cropReadyButtonClass + '">' + $jcrop.cropReadyButtonContent + '</a>'
									);
									$( '#' + $options.previewContainerID + '-bt-ready' ).bind( {
										click: function( ) {
											if ( imageResize( $fileObj, 'standard', $parentContainer ) ) {
												$('#' + $options.previewContainerID + '-crop-thumb').remove( );
												$('#' + $options.previewContainerID + '-bt-ready').remove( );
												if ( $options.addFX ) {
													$( '#' + $options.FXIContainer ).remove( );
													$parentContainer.bind( 'onResizeReady', function ( ) {
														$parentContainer.unbind( 'onResizeReady' );
														applyFX( $parentContainer );
														showImage( $options.previewContainerID );
													});
												}
												
												$options.onReadyForUpload.call( this, $fileObj );
											}
										}
									});
							});
						}
					} else {
						$error = 'Preview container is not assigned';
						return false;
					}
				break;
				default:
					$error = 'Unknown resize method';
					return false;
			}

			return true;
		}

		function getFXInterface( ) {
			if ( $options.previewContainerID !== false ) {
				var fxContainer = $options.FXIContainer,
					btReady = $options.previewContainerID + '-bt-ready',
					fxCanvas = 'imuplo-fx-canvas';

				if ( $options.resize && $options.resizeMethod == 'jcrop' ) {
					// --- canvas early setup ---
				} else {
					showImage( $options.previewContainerID );
					var cw = $( '#' + $options.previewContainerID ).width(),
						ch = $( '#' + $options.previewContainerID ).height();
					ch = (cw * ($fileObj.height / $fileObj.width )) | 0;
					$( '#' + $options.previewContainerID + '>img' ).hide();
					$( '#' + $options.previewContainerID ).prepend(
						'<canvas id="' + fxCanvas + '" width="'+ cw +'" height="'+ ch +'" style="width:'+ cw +'px; height:'+ ch +'px;">'
					);
					
					var previewCanvas = document.getElementById( fxCanvas ),
						ctx = previewCanvas.getContext('2d');

					ctx.drawImage($fileObj.imobj, 0, 0, $fileObj.width, $fileObj.height, 0, 0, previewCanvas.width, previewCanvas.height);
				}
				
				if ( !$options.resize || $options.resizeMethod != 'jcrop' ) {
					if ( isElExist( $options.previewContainerID + '-bt-ready' ) )
						$('#' + $options.previewContainerID + '-bt-ready').remove();
						$( '#' + $options.previewContainerID )
						.parent()
						.append(
							'<a href="#' + $options.previewContainerID + '" id="' + $options.previewContainerID + '-bt-ready" class="'
							+ $fx.readyButtonClass + '">' + $fx.readyButtonContent + '</a>'
						);
					$( '#' + $options.previewContainerID + '-bt-ready' ).bind( {
						click: function( ) {
							$('#' + $options.previewContainerID + '-bt-ready').remove( );
							$( '#' + $options.FXIContainer ).remove( );
							applyFX( $parentContainer );
							showImage( $options.previewContainerID );
							$options.onReadyForUpload.call( this, $fileObj );
						}
					});
				}
				
				if ( isElExist( fxContainer ) ) $('#' + fxContainer).remove();
				$( '#' + $options.previewContainerID ).parent().prepend('<div id="' + fxContainer + '"></div>');
				$options.FXList.forEach( function( e ) {
					var strength = $fx.presets[e][0];
					var name = $fx.presets[e][1];
					if ( typeof(name) == 'undefined' || name == null ) name = e;
					$( '#' + fxContainer ).append(
						'<a href="#' + $options.previewContainerID + '" fx="' + e + '" fx-strength="' + strength + '">' + name + '</a>'
					);
				});
				$( '#' + fxContainer + '>a' ).each( function ( ) {
					$(this).bind( {
						click: function () {
							$fileObj.fx = $( this ).attr( 'fx' );
							$( '#' + fxContainer + '>a' ).each( function ( ) { $( this ).removeClass('active'); });
							$( this ).addClass('active');
							$fileObj.fxStrength = $( this ).attr( 'fx-strength' );
							drawFX( fxCanvas );
						}
					});
				});
				$options.onFXReady.call( $this, $( '#' + fxContainer ) );

				return fxCanvas;
			} else {
				$error = 'Preview container is not assigned';
				return false;
			}
		}

		function setPixel(imageData, x, y, r, g, b, a) {
			index = (x + y * imageData.width) * 4;
			imageData.data[index+0] = r;
			imageData.data[index+1] = g;
			imageData.data[index+2] = b;
			imageData.data[index+3] = a;
		}

		function drawVignette ( w, h, f ) {
			tmp = document.getElementById( 'imuplo-vgn-canvas' );
			tmp.width = w;
			tmp.height = h;
			ctxt = tmp.getContext('2d');
			var grd = ctxt.createRadialGradient( w/2|0,w/2|0, w/2.2|0, w/2|0, w/2|0, w/((1-(1-f/100)) + 0.01)|0 );
			grd.addColorStop( 0, "white" );
			grd.addColorStop( 1, "black" );
			ctxt.fillStyle = grd;
			ctxt.fillRect( 0, 0, w, h );
			return ctxt.getImageData( 0, 0, w, h );
		}

		function drawFX( canv ) {
			var previewCanvas = document.getElementById( canv ),
				ctx = previewCanvas.getContext('2d');

	    	ctx.drawImage($fileObj.imobj, 0, 0, $fileObj.width, $fileObj.height, 0, 0, previewCanvas.width, previewCanvas.height);
			var imgObject = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
			var imgData = imgObject.data;

			switch ($fileObj.fx) {

				case 'megaguirus':
					for (var i = 0; i < imgData.length; i += 4) {
						var r = imgData[i],
							g = imgData[i+1],
							b = imgData[i+2],
							rgb = (r+g+b)/3;
						r += ($fileObj.fxStrength/2)/(255/rgb)|0;
						g += ($fileObj.fxStrength/1.8)/(255/rgb)|0;
						imgData[i] = r;
						imgData[i+1] = g;
						imgData[i+2] = b;
					}
				break;

				case 'biollante':
					for (var i = 0; i < imgData.length; i += 4) {
						var r = imgData[i],
							g = imgData[i+1],
							b = imgData[i+2];
							r += $fileObj.fxStrength/5|0;
						g -= $fileObj.fxStrength/4 | 0;
						b -= $fileObj.fxStrength/2 | 0;
						imgData[i] = r;
						imgData[i+1] = g;
						imgData[i+2] = b;
					}
				break;

				case 'godzilla':
					var y = 0,
						x = 0,
						vgnObject = {};
					for (var i = 0; i < imgData.length; i += 4) {
						var r = imgData[i],
							g = imgData[i+1],
							b = imgData[i+2],
							rgb = (r+g+b)/3;
						if ( x >= imgObject.width ) {
							x = 0;
							y ++;
						}
						b = b - ($fileObj.fxStrength/2|0);
						setPixel(imgObject, x, y, r, g, b, 255)
						x++;
					}
					$parentContainer.append(
						'<canvas id="imuplo-vgn-canvas" width="' + imgObject.width + '" height="' + 
						imgObject.height + '" style="width:' + imgObject.width + 'px; height:' + imgObject.height + 'px; display: none;">'
					);
					vgnObject = drawVignette( imgObject.width, imgObject.height, $fileObj.fxStrength );
					var tmpImgData = vgnObject.data;
					for (var i = 0; i < tmpImgData.length; i += 4) {
						var dc = 255 - tmpImgData[i] + ( tmpImgData[i]/( $fileObj.fxStrength+10 ) | 0 ) ;
						imgData[i] -= dc;
						imgData[i+1] -= dc;
						imgData[i+2] -= dc;
					}
					$( '#imuplo-vgn-canvas' ).remove();
				break;

				case 'hedorah':
					$parentContainer.append(
						'<canvas id="imuplo-vgn-canvas" width="' + imgObject.width + '" height="' + 
						imgObject.height + '" style="width:' + imgObject.width + 'px; height:' + imgObject.height + 'px; display: none;">'
					);
					vgnObject = drawVignette( imgObject.width, imgObject.height, $fileObj.fxStrength );
					var tmpImgData = vgnObject.data;
					for (var i = 0; i < tmpImgData.length; i += 4) {
						var dc = 255 - tmpImgData[i];
						imgData[i] -= dc;
						imgData[i+1] -= dc/1.5|0;
						imgData[i+2] -= dc/1.5|0;
					}
					$( '#imuplo-vgn-canvas' ).remove();
				break;

				case 'mothra':
					$parentContainer.append(
						'<canvas id="imuplo-vgn-canvas" width="' + imgObject.width + '" height="' + 
						imgObject.height + '" style="width:' + imgObject.width + 'px; height:' + imgObject.height + 'px; display: none;">'
					);
					vgnObject = drawVignette( imgObject.width, imgObject.height, $fileObj.fxStrength );
					var tmpImgData = vgnObject.data;
					for (var i = 0; i < tmpImgData.length; i += 4) {
						var dc = 255 - tmpImgData[i];
						imgData[i] -= dc/3|0;
						imgData[i+1] -= dc/1.5|0;
						imgData[i+2] -= dc|0;
						imgData[i] += $fileObj.fxStrength/6|0;
						imgData[i+1] -= $fileObj.fxStrength/6|0;
						imgData[i+2] -= $fileObj.fxStrength/2|0;
					}
					$( '#imuplo-vgn-canvas' ).remove();
				break;

				case 'megalon':
					var y = 0,
						x = 0;
					for (var i = 0; i < imgData.length; i += 4) {
						var r = imgData[i],
							g = imgData[i+1],
							b = imgData[i+2];
						if (x >= imgObject.width) {
							x = 0;
							y ++;
						}
						r = r - ($fileObj.fxStrength/1.5|0);
						g = g - ($fileObj.fxStrength/3|0);
						setPixel(imgObject, x, y, r, g, b, 255)
						x++;
					}
					$parentContainer.append(
						'<canvas id="imuplo-vgn-canvas" width="' + imgObject.width + '" height="' + 
						imgObject.height + '" style="width:' + imgObject.width + 'px; height:' + imgObject.height + 'px; display: none;">'
					);
					vgnObject = drawVignette( imgObject.width, imgObject.height, $fileObj.fxStrength );
					var tmpImgData = vgnObject.data;
					for (var i = 0; i < tmpImgData.length; i += 4) {
						var dc = 255 - tmpImgData[i] + ( tmpImgData[i]/( $fileObj.fxStrength+10 ) | 0 ) ;
						imgData[i] -= dc;
						imgData[i+1] -= dc;
						imgData[i+2] -= dc;
					}
					$( '#imuplo-vgn-canvas' ).remove();
				break;

				case 'gigan':
					$parentContainer.append(
						'<canvas id="imuplo-vgn-canvas" width="' + imgObject.width + '" height="' + 
						imgObject.height + '" style="width:' + imgObject.width + 'px; height:' + imgObject.height + 'px; display: none;">'
					);
					vgnObject = drawVignette( imgObject.width, imgObject.height, $fileObj.fxStrength );
					var tmpImgData = vgnObject.data;
					for (var i = 0; i < tmpImgData.length; i += 4) {
						var dc = 255 - tmpImgData[i];
						imgData[i] -= dc;
						imgData[i+1] -= dc/1.5|0;
						imgData[i+2] -= dc/2|0;
					}
					$( '#imuplo-vgn-canvas' ).remove();
				break;

				case 'bw':
					for (var i = 0; i < imgData.length; i += 4) {
						var avg = (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
						if (avg < 127) avg = avg - parseInt( $fileObj.fxStrength );
						if (avg >= 127) avg = avg + parseInt( $fileObj.fxStrength );
						imgData[i] = avg;
						imgData[i+1] = avg;
						imgData[i+2] = avg;
					}
				break;

				default:
				break;
			}

			ctx.putImageData(imgObject, 0, 0);
			return true;
		}

		function applyFX( wrapper ) {
			wrapper.prepend('<canvas id="imuplo-fxtmp-canvas" style="display: block;"></canvas>');
			canv = document.getElementById('imuplo-fxtmp-canvas');
			canv.width = $fileObj.width;
			canv.height = $fileObj.height;
			canv.getContext('2d').drawImage( $fileObj.imobj, 0, 0, $fileObj.width, $fileObj.height );
			drawFX( 'imuplo-fxtmp-canvas' );
			$fileObj.src = canv.toDataURL( $options.outputType, $options.compression );
			$fileObj.blob = dataURItoBlob( $fileObj.src );
			$fileObj.imobj.src = $fileObj.src;
			$( '#imuplo-fxtmp-canvas' ).remove();
		}

		function updateCropRegion( coords ) {
			if ($jcrop.displayThumb === true) {
				var rx = $jcrop.thumbSize[0] / coords.w;
				var ry = $jcrop.thumbSize[1] / coords.h;
				$('#' + $options.previewContainerID + '-crop-thumb').css({
					width: Math.round(rx * this.opt.boxWidth) + 'px',
					height: Math.round(ry * this.opt.boxHeight) + 'px',
					marginLeft: '-' + Math.round(rx * coords.x) + 'px',
					marginTop: '-' + Math.round(ry * coords.y) + 'px'
				});
			}
			var offset = translateGlobal( [ coords.x, coords.y ], [ this.opt.boxWidth, this.opt.boxHeight ] );
				$fileObj.cropOffset = offset;
			var size = translateGlobal( [ coords.w, coords.h ], [ this.opt.boxWidth, this.opt.boxHeight ] );
				$fileObj.cropSize = size;
			return true;
		}
		
		function translateGlobal( coords, box ) {
			var nc = [];
			nc[0] = coords[0] * ( $fileObj.width / box[0] ) | 0;
			if ( coords[0] == coords[1] )
				nc[1] = nc[0];
			else
				nc[1] = coords[1] * ( $fileObj.height / box[1] ) | 0;
			if ( nc[0] > $fileObj.width ) nc[0] = $fileObj.width;
			if ( nc[1] > $fileObj.height ) nc[1] = $fileObj.height;
			return nc;
		}

		function getFileData( f, el ) {
			var reader = new FileReader( );
			reader.onload = function( event ) {
				var img = new Image;
				img.src = event.target.result;
				img.onload = function( ) {
					var fileObj = {
							size: f.size,
							name: f.name,
							type: f.type,
							src: img.src,
							width: img.width,
							height: img.height,
							cropOffset: [ 0, 0 ],
							cropSize: [ 0, 0 ],
							fx: 'default',
							fxStrength: 0,
							blob: dataURItoBlob( img.src ),
							imobj: img
						}
					$fileObj = fileObj;
					el.trigger( 'dataReady' );
				}
			}
			reader.readAsDataURL( f );
		}

		function dataURItoBlob( dataURI ) {
			var tmp = dataURI.split(',');
			return tmp[tmp.length-1];
		}

		function showImage( c ) {
			if ( isElExist( c ) ) {
				$( '#' + c ).hide();
				$( '#' + c ).html('<img src="' + $fileObj.src + '" id="' + c + '-img' + '" />');
				$( '#' + c + '-img' ).css( 'width', $( '#' + c ).css('width') );
				$( '#' + c + '-img' ).load( function() {
					$( '#' + c ).append('<canvas id="imuplo-tmp-canvas" style="display: block;"></canvas>');
					canv = document.getElementById('imuplo-tmp-canvas');
					canv.width = $( '#' + c ).width();
					canv.height = $( '#' + c + '-img' ).height();
					$( '#' + c ).height( $( '#' + c + '-img' ).height() );
					canv.getContext('2d').drawImage( $fileObj.imobj, 0, 0, $fileObj.width, $fileObj.height, 0, 0, canv.width, canv.height );
					newSrc = canv.toDataURL( $options.outputType, $options.compression );
					$( '#imuplo-tmp-canvas' ).remove();
					$( '#' + c + '-img' ).attr( 'src', newSrc );
				});				
				$( '#' + c ).show();
				return $( '#' + c + '-img' );
			}
			return false;
		}

		function isValidFiles( f ) {
			if ( $options.maxFileSize > 0 )
				if ( f.size > $options.maxFileSize ) {
					$error = 'File too big';
					return false;
				}
			var ftypes = $options.acceptFileTypes,
				ftype = f.type,
				imageTypeRX = /^image\//;
			if ( $options.acceptFileTypes != 'image/*' && ftypes.indexOf(ftype) === -1 ) {
				$error = 'Wrong type of file';
				return false;
			}
			if ( !imageTypeRX.test( ftype ) ) {
				$error = 'Wrong type of file';
				return false;
			}
			return true;
		}
		
		function isValidImage( img ) {
			if ( ($options.minImageSize[0] && img[0] < $options.minImageSize[0]) || ($options.minImageSize[1] && img[1] < $options.minImageSize[1]) ) {
				$error = 'Image too small';
				return false;
			}
			if ( ($options.maxImageSize[0] && img[0] > $options.maxImageSize[0]) || ($options.maxImageSize[1] && img[1] > $options.maxImageSize[1]) ) {
				$error = 'Image too big';
				return false;
			}
			return true;
		}
		
		function killAll( c ) {
			$fileObj = {};
			$publicStatus = 'Image is not selected';
			if ( isElExist( 'imuplo-tmp-canvas' ) ) {
				$( '#imuplo-tmp-canvas' ).remove();
			}
			$options.onChange.call( this, $publicStatus );
		}
		// - - - - - - - - - -
	}

	$.fn.Imuplo.defaults = {

		acceptFileTypes: 'image/jpeg,image/png',
		maxFileSize: 0,
		multiple: false, // not supported
		previewContainerID: false,
		resize: false,
		addFX: false,
		useFXStrength: true,
		FXList: [ 'default', 'godzilla', 'megalon', 'gigan', 'hedorah', 'megaguirus', 'biollante', 'mothra', 'bw' ],
		FXIContainer: 'imuplo-fx-block',
		resizeMethod: 'standard',
		maxImageSize: [],
		minImageSize: [],
		scaleTo: [],
		outputType: 'image/jpeg',
		compression: 1,
		jcrop: {
			aspect: 1,
			thumbSize: [64, 64],
			displayThumb: false,
			thumbClass: 'imuplo-jcrop-thumb',
			cropReadyButtonClass: 'imuplo-jcrop-bt-cropready',
			cropReadyButtonContent: 'CROP'
		},
		FX: {
			readyButtonClass: 'imuplo-fx-bt-ready',
			readyButtonContent: 'APPLY',
			presets: {
				'default': 		[ 0,	'Без эффекта'],
				'godzilla':		[ 65 ],
				'megalon':		[ 75 ],
				'gigan':		[ 75 ],
				'hedorah':		[ 100 ],
				'megaguirus':	[ 75 ],
				'biollante':	[ 75 ],
				'mothra':		[ 75 ],
				'bw':			[ 0,	'Тлен' ]
			}
		},
		onChange: function () {},
		onReadyForUpload: function () {},
		onFXReady: function () {},
		onError: function () {}

	};
})( jQuery );
