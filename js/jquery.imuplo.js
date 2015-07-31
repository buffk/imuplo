/*
# jquery.imuplo.js v0.7.15.02
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
		if (typeof(opt) !== 'object') opt = {};
		var $options = $.extend( {}, $.fn.Imuplo.defaults, opt ),
			$files,
			$fileObj = {},
			$elCounter = 0,
			$error = '',
			$locked = false,
			$publicStatus = 'Image is not selected';

		$.each( ['onChange','onReadyForUpload','onError'], function( i, e ) {
			if ( typeof( $options[e] ) !== 'function' ) $options[e] = function () {};
		});

		$(this).each(function ( ) {
			var $this = $(this);
			if ( $this.data( 'Imuplo' ) ) return;
			$elCounter ++;
			$this.data( 'Imuplo', $elCounter );
			$this.click(function ( ) {
				if ( $locked ) return;
				var $parentContainer = $this.parent(  ),
					fileInputID = 'imuplo-input-file' + $elCounter;
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
											killAll( $elCounter, $options.previewContainerID );
											$options.onError.call( this, $error );
											return;
										}
										if ( $options.resize && $options.resizeMethod !== false ) {
											var newImg;
											if ( newImg = imageResize( $fileObj, $options.resizeMethod, $parentContainer ) ) {
												$fileObj = newImg; // Does it need a new img obj?
											} else {
												$options.onError.call( this, $error );
											}
										}
										if ( $options.previewContainerID !== false ) {
											showImage( $options.previewContainerID, $fileObj.src );
										}
										$options.onReadyForUpload.call( this, $fileObj );
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
			});
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

		function imageResize ( o, method, wrapper ) {
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
				if ( !sx || !sy ) {
					$error = 'Option "scaleTo" is undefined';
					return false;
				}

			if ( wrapperId == undefined ) {
				wrapperId = 'imuplo-tc-wrapper';
				wrapper.attr( 'id', wrapperId );
			} else {
				if ( wrapperId.length() < 1 ) {
					wrapperId = 'imuplo-tc-wrapper';
					wrapper.attr( 'id', wrapperId );
				}
			}
			switch (method) {
				case 'standart':
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
					wrapper.append('<canvas id="imuplo-tmp-canvas" style="display: none;"></canvas>');
					canv = document.getElementById('imuplo-tmp-canvas');
					canv.width = sx;
					canv.height = sy;
					canv.getContext('2d').drawImage( o.imobj, centreX, centreY, nw, nh, 0, 0, sx, sy);
					ob.src = canv.toDataURL( o.type, 0.8 );
					ob.width = sx;
					ob.height = sy;
					ob.blob = dataURItoBlob( ob.src );
					$( '#imuplo-tmp-canvas' ).remove();
				break;
				case 'Jcrop':
					// insert Jcrop plugin fty
				break;
				default:
					$error = 'Unknown resize method';
					return false;
			}

			return $.extend( o, ob );
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
			var byteString;
			if ( dataURI.split(',')[0].indexOf('base64') >= 0 )
				byteString = atob( dataURI.split(',')[1] );
			else
			byteString = unescape( dataURI.split(',')[1] );
			var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
			var ia = new Uint8Array( byteString.length );
			for ( var i = 0; i < byteString.length; i++ ) {
				ia[i] = byteString.charCodeAt(i);
			}
			return new Blob([ia], {type:mimeString});
		}

		function showImage( c, src ) {
			if ( isElExist( c ) ) {
				$( '#' + c ).html('<img src="' + src + '" id="' + c + '-img' + '" />');
				$( '#' + c + '-img' ).ready( function() {
					$( '#' + c + '-img' ).css( 'max-width', $( '#' + c ).css('width') );
					$( '#' + c + '-img' ).css( 'max-height', $( '#' + c ).css('height') );
				});
				$( '#' + c ).show();
			}
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
			if ( ftypes.indexOf(ftype) === -1 || !imageTypeRX.test( ftype ) ) {
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
		
		function killAll( i, c ) {
			$fileObj = {};
			$publicStatus = 'Image is not selected';
			if ( isElExist( c + '-img' ) ) {
				$( '#' + c + '-img' ).remove();
				$( '#' + c ).hide();
			}
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
		resizeMethod: 'standart', // + Jcrop - next version
		maxImageSize: [],
		minImageSize: [],
		scaleTo: [],

		onChange: function () {},
		onReadyForUpload: function () {},
		onError: function () {}

	};
})( jQuery );
