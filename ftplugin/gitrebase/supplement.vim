if exists('b:loaded_gin_gitrebase_supplement')
  finish
endif
let b:loaded_gin_gitrebase_supplement = 1

let s:COMMANDS = [
      \ 'p', 'pick',
      \ 'r', 'reword',
      \ 'e', 'edit',
      \ 's', 'squash',
      \ 'f', 'fixup',
      \ 'x', 'exec',
      \ 'd', 'drop',
      \]

function! s:find_value(winid) abort
  let bufnr = winbufnr(a:winid)
  let line = line('.', a:winid)
  let line = getbufline(bufnr, line)[0]
  let pattern = printf('^\%%(%s\) \zs[0-9a-fA-F]\+', join(s:COMMANDS, '\|'))
  return matchstr(line, pattern)
endfunction

function! s:init() abort
  function! s:init_internal(winid) abort closure
    let winid_saved = win_getid()
    try
      call win_gotoid(a:winid)

      augroup gin_status_supplement_internal
        autocmd! * <buffer>
        autocmd CursorHold <buffer> ++nested call s:update()
      augroup END

      call gin#supplement#init(a:winid, g:gin_gitrebase_supplements)
      call gin#supplement#open(a:winid)
      call gin#supplement#update(a:winid, s:find_value(a:winid))
    finally
      call win_gotoid(winid_saved)
    endtry
  endfunction

  let winid = win_getid()
  call denops#plugin#wait_async('gin', { -> s:init_internal(winid) })
endfunction

function! s:update() abort
  if mode() !=# 'n'
    return
  endif
  let winid = win_getid()
  let value = s:find_value(winid)
  silent! call gin#supplement#update(winid, value)
endfunction

let g:gin_gitrebase_supplements = get(g:, 'gin_gitrebase_supplements', [
      \ {
      \   'opener': 'botright vertical new',
      \   'command': { v -> printf('enew | silent! Gin! ++buffer show --pretty=fuller %s', v) },
      \ },
      \ {
      \   'opener': 'rightbelow 15split | set winfixwidth',
      \   'command': { v -> printf('enew | silent! Gin! ++buffer diff --stat %s', v) },
      \ },
      \])
call s:init()


