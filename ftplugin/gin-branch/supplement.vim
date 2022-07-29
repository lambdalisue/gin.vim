 if exists('b:loaded_gin_branch_supplement')
  finish
endif
let b:loaded_gin_branch_supplement = 1

function! s:find_value(winid) abort
  let bufnr = winbufnr(a:winid)
  let line = line('.', a:winid)
  try
    let candidates = gin#action#gather_candidates(bufnr, [line, line])
    return candidates[0].target
  catch
    return ''
  endtry
endfunction

function! s:init() abort
  let winid = win_getid()
  call denops#plugin#wait_async('gin', { -> s:init_internal(winid) })
endfunction

function! s:init_internal(winid) abort closure
  let bufnr = winbufnr(a:winid)
  if bufnr is# -1
    return
  endif
  augroup gin_branch_supplement_internal
    execute printf('autocmd! * <buffer=%d>', bufnr)
    execute printf('autocmd CursorHold <buffer=%d> call s:update()', bufnr)
  augroup END
  call gin#supplement#init(a:winid, g:gin_branch_supplements)
  call gin#supplement#open(a:winid)
  call gin#supplement#update(a:winid, s:find_value(a:winid))
endfunction

function! s:update() abort
  if mode() !=# 'n'
    return
  endif
  let winid = win_getid()
  let value = s:find_value(winid)
  call gin#supplement#update(winid, value)
endfunction

let g:gin_branch_supplements = get(g:, 'gin_branch_supplements', [
      \ {
      \   'opener': 'botright new',
      \   'command': { v -> printf('silent! Gin! ++buffer log --graph --decorate --oneline %s', v) },
      \ },
      \ {
      \   'opener': 'botright vertical new | set winfixwidth',
      \   'command': { v -> printf('silent! Gin! ++buffer show --pretty=fuller %s', v) },
      \ },
      \ {
      \   'opener': 'rightbelow 15new | set winfixwidth winfixheight',
      \   'command': { v -> printf('silent! Gin! ++buffer diff --stat %s', v) },
      \ },
      \])
call s:init()
