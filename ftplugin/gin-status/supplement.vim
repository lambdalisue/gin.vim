 if exists('b:loaded_gin_status_supplement')
  finish
endif
let b:loaded_gin_status_supplement = 1

function! s:find_value(winid) abort
  let bufnr = winbufnr(a:winid)
  let line = line('.', a:winid)
  try
    let candidates = gin#action#gather_candidates(bufnr, [line, line])
    return candidates[0].value
  catch
    return ''
  endtry
endfunction

function! s:init(supplements) abort
  augroup gin_status_supplement_init
    autocmd! * <buffer>
    autocmd CursorHold <buffer> ++nested diffoff! | call s:update(win_getid())
  augroup END
  let winid = win_getid()
  call gin#supplement#init(winid, a:supplements)
  call gin#supplement#open(winid)
  call s:update(winid)
endfunction

function! s:update(winid) abort
  if mode() !=# 'n'
    return
  endif
  let value = s:find_value(a:winid)
  call gin#supplement#update(a:winid, value)
endfunction

call s:init(get(g:, 'gin_status_supplements', [
      \ {
      \   'opener': 'botright new',
      \   'command': { v -> printf('enew | silent! GinEdit HEAD %s | 0file | setlocal noswapfile nobuflisted | diffthis', v) },
      \ },
      \ {
      \   'opener': 'rightbelow vertical new',
      \   'command': { v -> printf('enew | silent! GinEdit --cached %s | 0file | setlocal noswapfile nobuflisted | diffthis', v) },
      \ },
      \ {
      \   'opener': 'rightbelow vertical new',
      \   'command': { v -> printf('enew | silent! GinEdit %s | 0file | setlocal noswapfile nobuflisted | diffthis', v) },
      \ },
      \]))
