set nocompatible              " be iMproved, required

syn on
set tabstop=2
set softtabstop=2
set shiftwidth=2
set expandtab
set autoindent
"set smartindent
inoremap <F2> <C-X><C-F>
au Filetype make inoremap <tab> <tab>
au Filetype make set paste
au Filetype make set noexpandtab
set background=dark
set nowrap
syntax sync minlines=1500
set ruler
set path=.,/usr/include,/Users/aultac/Desktop/Research/ingredients_inc/wxWidgets/wxWidgets-2.6.3/include

au BufNewFile,BufRead *.jrn	setf jrn
au Filetype jrn set wm=2
au Filetype jrn set textwidth=100
au Filetype jrn source ~/.vim_normaltab
au BufNewFile,BufRead TODO.jrn	set foldmethod=indent
au BufNewFile,BufRead TODO.jrn	set foldlevel=1
au BufNewFile,BufRead TODO.jrn	set shiftwidth=2

au Filetype cpp set foldmethod=marker
au Filetype cpp set foldlevel=0
au Filetype cpp set foldmarker={,}
au Filetype php set foldmethod=marker
au Filetype php set foldlevel=0
au Filetype php set foldmarker={,}
au Filetype javascript set foldmethod=marker
au Filetype javascript set foldlevel=1
au Filetype javascript set foldmarker={,}

au FileType matlab set shiftwidth=4
au FileType matlab set softtabstop=4

" Stuff for ctags
set nocp
filetype plugin on
map <C-F6> :ctags -R --c++-kinds=+p --fields=+iaS --extra=+q .<CR>
function! SuperCleverTab()
    if strpart(getline('.'), 0, col('.') - 1) =~ '^\s*$'
        return "\<Tab>"
    else
        if &omnifunc != ''
            return "\<C-X>\<C-O>"
        elseif &dictionary != ''
            return "\<C-K>"
        else
            return "\<C-N>"
        endif
    endif
endfunction
inoremap <s-Tab> <C-R>=SuperCleverTab()<cr>
inoremap <Tab> <C-P>
set tags+=$HOME/.vim/tagfiles/OpenGL-cpp.tags
set tags+=$HOME/.vim/tagfiles/SDL-cpp.tags

filetype plugin indent on

" Used for csstidy to minify-unminify css code
autocmd filetype css setlocal equalprg=csstidy\ -\ --silent=true

" Default js template string prettifier to use markdown.  To change,
" :JsPreTempl html
autocmd FileType javascript JsPreTmpl markdown

" Use jsx highlighting for js files too
let g:jsx_ext_required = 0
