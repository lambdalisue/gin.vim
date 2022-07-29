if exists('g:loaded_gin_branch')
  finish
endif
let g:loaded_gin_branch = 1

augroup gin_plugin_branch_internal
  autocmd!
  autocmd BufReadCmd ginbranch://* call denops#request('gin', 'branch:read', [])
augroup END

function! s:command(...) abort
  if denops#plugin#wait('gin')
    return
  endif
  call denops#request('gin', 'branch:command', a:000)
endfunction

command! -bar -nargs=* GinBranch call s:command(<q-mods>, <f-args>)
